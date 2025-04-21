// GoogleMapsTimelineActivityViewer
// timeline-viewer.js ver. 5

// Add this to the top with other global variables
let use24HourFormat = true;

// Parse location history data
function parseCoordinates(coordinates) {
  if (typeof coordinates === 'string') {
    if (coordinates.includes('°')) {
      return coordinates.split(', ').map(coord => parseFloat(coord.replace('°', '')));
    }
    return coordinates.replace('geo:', '').split(',').map(coord => parseFloat(coord));
  }
  // Handle direct latLng object format
  return [coordinates.latitude || coordinates.lat, coordinates.longitude || coordinates.lng];
}

function parseRawArray(data) {
  return data.flatMap(item => {
    if (item.visit?.topCandidate?.placeLocation) {
      const [lat, lng] = parseCoordinates(item.visit.topCandidate.placeLocation);
      return [{
        type: 'visit',
        name: item.visit.topCandidate.semanticType || "Unknown Location",
        placeId: item.visit.topCandidate.placeID || item.visit.topCandidate.placeId || null, // Support both placeID and placeId
        start_time: item.startTime,
        end_time: item.endTime,
        latitude: lat,
        longitude: lng
      }];
    }

    if (item.activity?.start && item.activity?.end) {
      const [startLat, startLng] = parseCoordinates(item.activity.start);
      const [endLat, endLng] = parseCoordinates(item.activity.end);
      return [{
        type: 'activity',
        activity: item.activity.topCandidate?.type || "Unknown Activity",
        start_time: item.startTime,
        end_time: item.endTime,
        start_latitude: startLat,
        start_longitude: startLng,
        end_latitude: endLat,
        end_longitude: endLng
      }];
    }

    if (item.timelinePath) {
      let points = item.timelinePath.map((point, index, array) => {
        if (index === array.length - 1) return null;

        const [startLat, startLng] = parseCoordinates(point.point);
        const [endLat, endLng] = parseCoordinates(array[index + 1].point);

        const startTime = point.durationMinutesOffsetFromStartTime
          ? moment(item.startTime).add(point.durationMinutesOffsetFromStartTime, 'minutes')
          : moment(item.startTime);

        const endTime = array[index + 1].durationMinutesOffsetFromStartTime
          ? moment(item.startTime).add(array[index + 1].durationMinutesOffsetFromStartTime, 'minutes')
          : moment(item.startTime);

        return {
          type: 'activity',
          activity: 'Movement',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          start_latitude: startLat,
          start_longitude: startLng,
          end_latitude: endLat,
          end_longitude: endLng
        };
      }).filter(Boolean);

      return points;
    }

    return null;
  }).filter(Boolean);
}

function parseSemanticSegments(segments) {
  return segments.flatMap(segment => {
    if (segment.timelinePath) {
      let points = segment.timelinePath.map((point, index, array) => {
        if (index === array.length - 1) return null;

        const [startLat, startLng] = parseCoordinates(point.point);
        const [endLat, endLng] = parseCoordinates(array[index + 1].point);

        return {
          type: 'activity',
          activity: 'Movement',
          start_time: point.time,
          end_time: array[index + 1].time,
          start_latitude: startLat,
          start_longitude: startLng,
          end_latitude: endLat,
          end_longitude: endLng
        };
      }).filter(Boolean);

      return points;
    }

    if (segment.visit) {
      const [lat, lng] = parseCoordinates(segment.visit.topCandidate.placeLocation.latLng);
      return [{
        type: 'visit',
        name: segment.visit.topCandidate.semanticType || "Unknown Location",
        placeId: segment.visit.topCandidate.placeID || segment.visit.topCandidate.placeId || null, // Support both placeID and placeId
        start_time: segment.startTime,
        end_time: segment.endTime,
        latitude: lat,
        longitude: lng
      }];
    }

    if (segment.activity?.start?.latLng) {
      const [startLat, startLng] = parseCoordinates(segment.activity.start.latLng);
      const [endLat, endLng] = parseCoordinates(segment.activity.end.latLng);
      return [{
        type: 'activity',
        activity: segment.activity.type || "Unknown Activity",
        start_time: segment.startTime,
        end_time: segment.endTime,
        start_latitude: startLat,
        start_longitude: startLng,
        end_latitude: endLat,
        end_longitude: endLng
      }];
    }

    return null;
  }).filter(Boolean);
}

function parseRawSignals(signals) {
  return signals.flatMap((signal, index, array) => {
    if (!signal.position?.LatLng || index === array.length - 1) return null;

    const [startLat, startLng] = parseCoordinates(signal.position.LatLng);
    const nextSignal = array[index + 1];
    if (!nextSignal.position?.LatLng) return null;

    const [endLat, endLng] = parseCoordinates(nextSignal.position.LatLng);

    return [{
      type: 'activity',
      activity: 'Movement',
      start_time: signal.position.timestamp,
      end_time: nextSignal.position.timestamp,
      start_latitude: startLat,
      start_longitude: startLng,
      end_latitude: endLat,
      end_longitude: endLng
    }];
  }).filter(Boolean);
}

async function loadLocationHistory() {
  try {
    const response = await fetch("location-history.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Handle both array and object formats
    timelineData = [];
    if (Array.isArray(data)) {
      timelineData = parseRawArray(data);
    } else {
      if (data.semanticSegments) {
        timelineData = timelineData.concat(parseSemanticSegments(data.semanticSegments));
      }
      if (data.rawSignals) {
        timelineData = timelineData.concat(parseRawSignals(data.rawSignals));
      }
    }

    const selectedDate = moment(document.getElementById("datePicker").value);
    await loadTimelineDataForDate(selectedDate);
  } catch (error) {
    console.error("Error loading location history:", error);
  }
}

// Place details cache
let placeDetailsCache = new Map();

// Fetch place details from Google Places API
async function fetchPlaceDetails(placeId) {
  // Return from cache if available
  if (placeDetailsCache.has(placeId)) {
    return placeDetailsCache.get(placeId);
  }
  
  return new Promise((resolve, reject) => {
    if (!placeId) {
      resolve(null);
      return;
    }
    
    const placesService = new google.maps.places.PlacesService(map);
    
    placesService.getDetails(
      {
        placeId: placeId,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'rating', 'website', 'types', 'opening_hours', 'photos']
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
          placeDetailsCache.set(placeId, place);
          resolve(place);
        } else {
          console.warn(`Failed to fetch place details for ${placeId}: ${status}`);
          resolve(null);
        }
      }
    );
  });
}

// Create and display place details info window
function createPlaceDetailsInfoWindow(placeDetails) {
  let content = '<div class="place-details-info">';
  
  // Name
  content += `<h3>${placeDetails.name}</h3>`;
  
  // Address
  if (placeDetails.formatted_address) {
    content += `<p><strong>Address:</strong> ${placeDetails.formatted_address}</p>`;
  }
  
  // Phone
  if (placeDetails.formatted_phone_number) {
    content += `<p><strong>Phone:</strong> ${placeDetails.formatted_phone_number}</p>`;
  }
  
  // Rating
  if (placeDetails.rating) {
    content += `<p><strong>Rating:</strong> ${placeDetails.rating} / 5</p>`;
  }
  
  // Website
  if (placeDetails.website) {
    content += `<p><strong>Website:</strong> <a href="${placeDetails.website}" target="_blank">${placeDetails.website}</a></p>`;
  }
  
  // Types
  if (placeDetails.types && placeDetails.types.length > 0) {
    content += `<p><strong>Type:</strong> ${placeDetails.types.map(type => type.replace(/_/g, ' ')).join(', ')}</p>`;
  }
  
  // Opening hours
  if (placeDetails.opening_hours && placeDetails.opening_hours.weekday_text) {
    content += '<p><strong>Opening Hours:</strong></p><ul>';
    placeDetails.opening_hours.weekday_text.forEach(day => {
      content += `<li>${day}</li>`;
    });
    content += '</ul>';
  }
  
  // Photos - Just show the first one if available
  if (placeDetails.photos && placeDetails.photos.length > 0) {
    const photoUrl = placeDetails.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 });
    content += `<img src="${photoUrl}" alt="${placeDetails.name}" style="width:100%;max-width:300px;margin-top:10px;">`;
  }
  
  content += '</div>';
  
  return content;
}

// Visualization code
let map;
let markers = [];
let polylines = [];
let animationPath = [];
let animationPolyline;
let timelineData = [];
let animationInterval;
let isPlaying = false;
let currentAnimationIndex = 0;
let markersCache = new Map();
let boundsCache = new Map();
let infoWindow;

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Create the debounced version of loadTimelineDataForDate
const debouncedLoadTimelineData = debounce(loadTimelineDataForDate, 250);

function createCustomMarkerElement(type, label) {
  const cacheKey = `${type}-${label}`;
  if (markersCache.has(cacheKey)) {
    return markersCache.get(cacheKey).cloneNode(true);
  }

  const markerElement = document.createElement("div");
  markerElement.style.width = "30px";
  markerElement.style.height = "30px";
  markerElement.style.borderRadius = "50%";
  markerElement.style.backgroundColor = type === "visit" ? "#4285F4" : "#FF0000";
  markerElement.style.color = "white";
  markerElement.style.display = "flex";
  markerElement.style.alignItems = "center";
  markerElement.style.justifyContent = "center";
  markerElement.style.fontWeight = "bold";
  markerElement.style.fontSize = "14px";
  markerElement.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
  markerElement.style.transition = "transform 0.2s ease";
  markerElement.innerText = label;

  markersCache.set(cacheKey, markerElement);
  return markerElement;
}

function initMap() {
  try {
    map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: 0, lng: 0 },
      zoom: 2,
      mapId: "MY_MAP_ID",
      gestureHandling: "greedy",
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    animationPolyline = new google.maps.Polyline({
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map: map
    });

    // Create a single reusable info window
    infoWindow = new google.maps.InfoWindow();

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'map-loading';
    loadingDiv.style.display = 'none';
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(loadingDiv);
  } catch (error) {
    console.error("Error initializing map:", error);
  }
}

function clearMap() {
  markers.forEach(marker => marker.setMap(null));
  markers = [];
  polylines.forEach(polyline => polyline.setMap(null));
  polylines = [];
  animationPath = [];
  if (animationPolyline) {
    animationPolyline.setPath([]);
  }
  if (infoWindow) {
    infoWindow.close();
  }
}

function stopAnimation() {
  isPlaying = false;
  clearInterval(animationInterval);
  document.getElementById("playBtn").textContent = "Play Timeline";
  const datePicker = document.getElementById("datePicker");
  loadTimelineDataForDate(moment(datePicker.value));
}

// Modify the formatTimeWithTimezone function to respect the time format setting
function formatTimeWithTimezone(timestamp, timezone, format) {
  const tz = timezone || detectTimezone();
  // Use the format parameter if provided, otherwise use the global setting
  const timeFormat = format || (use24HourFormat ? "HH:mm z" : "hh:mm A z");
  return moment(timestamp).tz(tz).format(timeFormat);
}

// Detect timezone with multiple fallback strategies
function detectTimezone(coordinates) {
  // If coordinates are provided, try coordinate-based lookup first
  if (coordinates && coordinates.lat && coordinates.lng) {
    try {
      if (window.geolibTimezone && window.geolibTimezone.getTimezoneByPosition) {
        const tz = window.geolibTimezone.getTimezoneByPosition({
          latitude: coordinates.lat,
          longitude: coordinates.lng
        });
        if (tz) return tz;
      } else {
        console.warn('geolibTimezone is not available.');
      }
    } catch (error) {
      console.warn('Coordinate-based timezone lookup failed:', error);
    }
  }

  // Fall back to browser's timezone detection
  try {
    const browserTz = moment.tz.guess();
    if (browserTz) return browserTz;
  } catch (error) {
    console.warn('Browser timezone detection failed:', error);
  }

  // Ultimate fallback to UTC
  return 'UTC';
}

async function renderPoint(point, index, opacity = 1.0) {
  if (point.type === "visit") {
    const markerElement = createCustomMarkerElement("visit", index + 1);
    const marker = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: point.latitude, lng: point.longitude },
      map,
      content: markerElement
    });
    markers.push(marker);
    
    // Add event listener to show place details when clicked
    if (point.placeId) {
      marker.addListener('click', async () => {
        // Show loading state in info window
        infoWindow.setContent('<div style="text-align:center;padding:10px;">Loading place details...</div>');
        infoWindow.open(map, marker);
        
        // Fetch place details and update info window
        const placeDetails = await fetchPlaceDetails(point.placeId);
        if (placeDetails) {
          infoWindow.setContent(createPlaceDetailsInfoWindow(placeDetails));
        } else {
          infoWindow.setContent(`<div style="text-align:center;padding:10px;"><strong>${point.name || "Unknown Location"}</strong><br>No additional details available</div>`);
        }
      });
    }
  } else if (point.type === "activity") {
    // Draw path
    const path = [
      { lat: point.start_latitude, lng: point.start_longitude },
      { lat: point.end_latitude, lng: point.end_longitude }
    ];

    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: opacity,
      strokeWeight: 3,
      map: map
    });
    polylines.push(polyline);

    // Add markers at start and end points
    const startMarkerElement = createCustomMarkerElement("activity", index + 1);
    const startMarker = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: point.start_latitude, lng: point.start_longitude },
      map,
      content: startMarkerElement
    });
    markers.push(startMarker);
  }
}

async function playTimeline(relevantData) {
  if (isPlaying) {
    stopAnimation();
    return;
  }

  isPlaying = true;
  document.getElementById("playBtn").textContent = "Stop Animation";
  clearMap();

  currentAnimationIndex = 0;
  animationPath = [];

  const animationSpeed = 1000; // 1 second between points

  const highlightTimelineItem = (index) => {
    document.querySelectorAll('.timeline-item').forEach(item => {
      item.classList.remove('highlighted');
      if (item.dataset.index === String(index)) {
        item.classList.add('highlighted');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  const animate = () => {
    if (!isPlaying || currentAnimationIndex >= relevantData.length) {
      stopAnimation();
      return;
    }

    const item = relevantData[currentAnimationIndex];
    highlightTimelineItem(currentAnimationIndex);

    if (item.type === "visit") {
      renderPoint(item, currentAnimationIndex);
      animationPath.push({ lat: item.latitude, lng: item.longitude });
    } else if (item.type === "activity") {
      renderPoint(item, currentAnimationIndex);
      animationPath.push(
        { lat: item.start_latitude, lng: item.start_longitude },
        { lat: item.end_latitude, lng: item.end_longitude }
      );
    }

    animationPolyline.setPath(animationPath);

    const bounds = new google.maps.LatLngBounds();
    animationPath.forEach(point => bounds.extend(point));
    map.fitBounds(bounds, { padding: 50 });

    currentAnimationIndex++;
  };

  animationInterval = setInterval(animate, animationSpeed);
  animate();
}

async function loadTimelineDataForDate(selectedDate) {
  try {
    document.getElementById('map-loading').style.display = 'block';
    clearMap();
    document.getElementById("timeline").innerHTML = "";

    const relevantData = timelineData
      .filter(item => moment(item.start_time).isSame(selectedDate, "day"))
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const bounds = new google.maps.LatLngBounds();
    let hasValidPoints = false;

    const fragment = document.createDocumentFragment();

    // Create a loading queue for place details
    const placeDetailsPromises = [];

    relevantData.forEach((item, index) => {
      // Create timeline item
      const timelineItem = createTimelineItem(item, index);
      fragment.appendChild(timelineItem);

      // Queue place details fetching for visits with placeIds
      if (item.type === "visit" && item.placeId) {
        const detailsPromise = fetchPlaceDetails(item.placeId).then(details => {
          if (details) {
            updateTimelineItemWithPlaceDetails(item, timelineItem, details);
          }
          return { index, details };
        });
        placeDetailsPromises.push(detailsPromise);
      }

      // Render point on map
      renderPoint(item, index);

      // Update bounds
      if (item.type === "visit") {
        bounds.extend({ lat: item.latitude, lng: item.longitude });
        hasValidPoints = true;
      } else if (item.type === "activity") {
        bounds.extend({ lat: item.start_latitude, lng: item.start_longitude });
        bounds.extend({ lat: item.end_latitude, lng: item.end_longitude });
        hasValidPoints = true;
      }
    });

    document.getElementById("timeline").appendChild(fragment);

    if (hasValidPoints) {
      map.fitBounds(bounds, { padding: 50 });
    }

    // Wait for all place details to be fetched
    if (placeDetailsPromises.length > 0) {
      Promise.all(placeDetailsPromises).then(() => {
        document.getElementById('map-loading').style.display = 'none';
      });
    } else {
      document.getElementById('map-loading').style.display = 'none';
    }

    return relevantData;
  } catch (error) {
    console.error("Error loading timeline data:", error);
    document.getElementById('map-loading').style.display = 'none';
  }
}

// Update timeline item with place details
function updateTimelineItemWithPlaceDetails(item, timelineItem, placeDetails) {
  // Add a "View Details" button
  const detailsButton = document.createElement('button');
  detailsButton.className = 'details-button';
  detailsButton.textContent = 'View Details';
  detailsButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering the parent click event
    
    // Create and display modal with place details
    showPlaceDetailsModal(placeDetails);
  });
  
  // Append the button to the timeline item
  timelineItem.appendChild(detailsButton);
  
  // Add a class to indicate this item has details
  timelineItem.classList.add('has-details');
  
  // If we have a more specific name from Place Details, update it
  if (placeDetails.name && placeDetails.name !== item.name) {
    const nameElement = timelineItem.querySelector('strong');
    if (nameElement) {
      nameElement.textContent = placeDetails.name;
    }
  }
}

// Create and show modal with place details
function showPlaceDetailsModal(placeDetails) {
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'place-details-modal';
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  // Create close button
  const closeButton = document.createElement('span');
  closeButton.className = 'close-button';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Create content container
  const contentContainer = document.createElement('div');
  contentContainer.innerHTML = createPlaceDetailsInfoWindow(placeDetails);
  
  // Assemble modal
  modalContent.appendChild(closeButton);
  modalContent.appendChild(contentContainer);
  modal.appendChild(modalContent);
  
  // Add click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
  
  // Add to body
  document.body.appendChild(modal);
  
  // Add ESC key to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// Calculate and format duration
function formatDuration(startTime, endTime) {
  const start = moment(startTime);
  const end = moment(endTime);
  const duration = moment.duration(end.diff(start));
  
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Update the createTimelineItem function to show duration
function createTimelineItem(item, index) {
  const timelineItem = document.createElement("div");
  timelineItem.className = "timeline-item";
  timelineItem.dataset.index = index;

  const timezone = item.type === "visit"
    ? detectTimezone({ lat: item.latitude, lng: item.longitude })
    : detectTimezone({ lat: item.start_latitude, lng: item.start_longitude });

  const startTime = formatTimeWithTimezone(item.start_time, timezone);
  const endTime = formatTimeWithTimezone(item.end_time, timezone);
  const duration = formatDuration(item.start_time, item.end_time);

  let content = '';
  if (item.type === "visit") {
    content = `
      <strong>${item.name || "Unknown Location"}</strong><br>
      ${startTime} - ${endTime} (${duration})
    `;
    
    // Add a loading indicator for places with IDs
    if (item.placeId) {
      content += '<div class="place-loading">Loading details...</div>';
    }
  } else if (item.type === "activity") {
    content = `
      <strong>${item.activity || "Movement"}</strong><br>
      ${startTime} - ${endTime} (${duration})
    `;
  }

  timelineItem.innerHTML = content;
  timelineItem.addEventListener('click', () => {
    // Existing click handler code...
  });

  return timelineItem;
}

// Add some CSS for the place details features
function addPlaceDetailsStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .place-details-info {
      padding: 10px;
      max-width: 300px;
      font-family: Arial, sans-serif;
    }
    
    .place-details-info h3 {
      margin-top: 0;
      color: #4285F4;
    }
    
    .place-details-info p {
      margin: 5px 0;
    }
    
    .place-details-info ul {
      margin: 5px 0;
      padding-left: 20px;
    }
    
    .place-loading {
      font-style: italic;
      color: #888;
      font-size: 0.9em;
    }
    
    .timeline-item.has-details {
      background-color: #f0f7ff;
    }
    
    .details-button {
      background-color: #4285F4;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 5px;
      font-size: 0.9em;
    }
    
    .details-button:hover {
      background-color: #356ac3;
    }
    
    .place-details-modal {
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.7);
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .modal-content {
      background-color: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
    }
    
    .close-button {
      position: absolute;
      right: 10px;
      top: 10px;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    }
    
    .close-button:hover {
      color: #000;
    }
  `;
  document.head.appendChild(style);
}

window.onload = async () => {
  try {
    initMap();
    addPlaceDetailsStyles();

    // Add this to the window.onload function, before the datePicker event listener
    const timeFormatToggle = document.createElement("button");
    timeFormatToggle.id = "timeFormatToggle";
    timeFormatToggle.className = "control-button";
    timeFormatToggle.textContent = "24h Format: OFF";
    timeFormatToggle.addEventListener("click", async () => {
        use24HourFormat = !use24HourFormat;
        timeFormatToggle.textContent = `24h Format: ${use24HourFormat ? "ON" : "OFF"}`;
        const selectedDate = moment(datePicker.value);
        await debouncedLoadTimelineData(selectedDate);
    });

    // Check if controls element exists before appending
    const controlsElement = document.querySelector(".controls");
    if (controlsElement) {
        controlsElement.appendChild(timeFormatToggle);
    } else {
        // If it doesn't exist, create the controls element
        const controlsDiv = document.createElement("div");
        controlsDiv.className = "controls";
        controlsDiv.appendChild(timeFormatToggle);

        // If it doesn't exist, create the controls element
        const mapElement = document.getElementById("map");
        if (mapElement) {
            mapElement.parentNode.insertBefore(controlsDiv, mapElement);
        } else {
            document.body.appendChild(controlsDiv);
        }
        console.log("Created missing controls container");
    }

    document.querySelector(".controls").appendChild(timeFormatToggle);

    const datePicker = document.getElementById("datePicker");
    datePicker.value = moment().format("YYYY-MM-DD");

    datePicker.addEventListener("change", async () => {
      const selectedDate = moment(datePicker.value);
      await debouncedLoadTimelineData(selectedDate);
    });

    document.getElementById("prevDayBtn").addEventListener("click", async () => {
      const selectedDate = moment(datePicker.value).subtract(1, "days");
      datePicker.value = selectedDate.format("YYYY-MM-DD");
      await debouncedLoadTimelineData(selectedDate);
    });

    document.getElementById("nextDayBtn").addEventListener("click", async () => {
      const selectedDate = moment(datePicker.value).add(1, "days");
      datePicker.value = selectedDate.format("YYYY-MM-DD");
      await debouncedLoadTimelineData(selectedDate);
    });

    document.getElementById("playBtn").addEventListener("click", async () => {
      const selectedDate = moment(datePicker.value);
      const relevantData = await loadTimelineDataForDate(selectedDate);
      playTimeline(relevantData);
    });

    document.addEventListener('keydown', async (e) => {
      if (e.key === 'ArrowLeft') {
        document.getElementById("prevDayBtn").click();
      } else if (e.key === 'ArrowRight') {
        document.getElementById("nextDayBtn").click();
      } else if (e.key === ' ') {
        e.preventDefault();
        document.getElementById("playBtn").click();
      }
    });

    await loadLocationHistory();
  } catch (error) {
    console.error("Error initializing application:", error);
  }
};
