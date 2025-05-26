// Global variables
let use24HourFormat = true;
let map, infoWindow;
let markers = [], polylines = [];
let animationPath = [], animationPolyline;
let timelineData = [];
let animationInterval;
let isPlaying = false;
let currentAnimationIndex = 0;
let markersCache = new Map();
let placeDetailsCache = new Map();

// Utility functions
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

function parseCoordinates(coordinates) {
  if (typeof coordinates === 'string') {
    if (coordinates.includes('°')) {
      return coordinates.split(', ').map(coord => parseFloat(coord.replace('°', '')));
    }
    return coordinates.replace('geo:', '').split(',').map(coord => parseFloat(coord));
  }
  return [coordinates.latitude || coordinates.lat, coordinates.longitude || coordinates.lng];
}

function detectTimezone(coordinates) {
  if (coordinates?.lat && coordinates?.lng) {
    try {
      if (window.geolibTimezone?.getTimezoneByPosition) {
        const tz = window.geolibTimezone.getTimezoneByPosition({
          latitude: coordinates.lat,
          longitude: coordinates.lng
        });
        if (tz) return tz;
      }
    } catch (error) {
      console.warn('Coordinate-based timezone lookup failed:', error);
    }
  }

  try {
    const browserTz = moment.tz.guess();
    if (browserTz) return browserTz;
  } catch (error) {
    console.warn('Browser timezone detection failed:', error);
  }

  return 'UTC';
}

function formatTimeWithTimezone(timestamp, timezone, format) {
  const tz = timezone || detectTimezone();
  const timeFormat = format || (use24HourFormat ? "HH:mm z" : "hh:mm A z");
  return moment(timestamp).tz(tz).format(timeFormat);
}

function formatDuration(startTime, endTime) {
  const duration = moment.duration(moment(endTime).diff(moment(startTime)));
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// Data parsing functions
function createLocationObject(type, data, startTime, endTime) {
  const baseObj = { type, start_time: startTime, end_time: endTime };
  
  if (type === 'visit') {
    const [lat, lng] = parseCoordinates(data.placeLocation);
    return {
      ...baseObj,
      name: data.semanticType || "Unknown Location",
      placeId: data.placeID || data.placeId || null,
      latitude: lat,
      longitude: lng
    };
  }
  
  if (type === 'activity') {
    const [startLat, startLng] = parseCoordinates(data.start);
    const [endLat, endLng] = parseCoordinates(data.end);
    return {
      ...baseObj,
      activity: data.type || "Unknown Activity",
      start_latitude: startLat,
      start_longitude: startLng,
      end_latitude: endLat,
      end_longitude: endLng
    };
  }
}

function parseTimelinePath(timelinePath, startTime) {
  return timelinePath.map((point, index, array) => {
    if (index === array.length - 1) return null;

    const [startLat, startLng] = parseCoordinates(point.point || point.position?.LatLng);
    const [endLat, endLng] = parseCoordinates(array[index + 1].point || array[index + 1].position?.LatLng);

    const startMoment = point.durationMinutesOffsetFromStartTime
      ? moment(startTime).add(point.durationMinutesOffsetFromStartTime, 'minutes')
      : moment(point.time || point.position?.timestamp || startTime);

    const endMoment = array[index + 1].durationMinutesOffsetFromStartTime
      ? moment(startTime).add(array[index + 1].durationMinutesOffsetFromStartTime, 'minutes')
      : moment(array[index + 1].time || array[index + 1].position?.timestamp || startTime);

    return {
      type: 'activity',
      activity: 'Movement',
      start_time: startMoment.toISOString(),
      end_time: endMoment.toISOString(),
      start_latitude: startLat,
      start_longitude: startLng,
      end_latitude: endLat,
      end_longitude: endLng
    };
  }).filter(Boolean);
}

function parseDataSegment(segment) {
  if (segment.timelinePath) {
    return parseTimelinePath(segment.timelinePath, segment.startTime);
  }

  if (segment.visit) {
    const location = segment.visit.topCandidate.placeLocation.latLng || segment.visit.topCandidate.placeLocation;
    return [createLocationObject('visit', {
      placeLocation: location,
      semanticType: segment.visit.topCandidate.semanticType,
      placeID: segment.visit.topCandidate.placeID,
      placeId: segment.visit.topCandidate.placeId
    }, segment.startTime, segment.endTime)];
  }

  if (segment.activity) {
    const activityData = segment.activity.start?.latLng ? segment.activity : segment.activity.topCandidate;
    if (activityData?.start) {
      return [createLocationObject('activity', {
        start: activityData.start.latLng || activityData.start,
        end: activityData.end.latLng || activityData.end,
        type: activityData.type
      }, segment.startTime, segment.endTime)];
    }
  }

  return [];
}

async function loadLocationHistory() {
  try {
    const response = await fetch("location-history.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    timelineData = [];
    
    if (Array.isArray(data)) {
      timelineData = data.flatMap(parseDataSegment).filter(Boolean);
    } else {
      if (data.semanticSegments) {
        timelineData = timelineData.concat(data.semanticSegments.flatMap(parseDataSegment));
      }
      if (data.rawSignals) {
        timelineData = timelineData.concat(parseTimelinePath(data.rawSignals));
      }
    }

    const selectedDate = moment(document.getElementById("datePicker").value);
    await loadTimelineDataForDate(selectedDate);
  } catch (error) {
    console.error("Error loading location history:", error);
  }
}

// Google Places API functions
async function fetchPlaceDetails(placeId) {
  if (!placeId || placeDetailsCache.has(placeId)) {
    return placeDetailsCache.get(placeId) || null;
  }

  return new Promise((resolve) => {
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

function createPlaceDetailsInfoWindow(placeDetails) {
  const sections = [
    `<h3>${placeDetails.name}</h3>`,
    placeDetails.formatted_address && `<p><strong>Address:</strong> ${placeDetails.formatted_address}</p>`,
    placeDetails.formatted_phone_number && `<p><strong>Phone:</strong> ${placeDetails.formatted_phone_number}</p>`,
    placeDetails.rating && `<p><strong>Rating:</strong> ${placeDetails.rating} / 5</p>`,
    placeDetails.website && `<p><strong>Website:</strong> <a href="${placeDetails.website}" target="_blank">${placeDetails.website}</a></p>`,
    placeDetails.types?.length && `<p><strong>Type:</strong> ${placeDetails.types.map(type => type.replace(/_/g, ' ')).join(', ')}</p>`,
    placeDetails.opening_hours?.weekday_text && `<p><strong>Opening Hours:</strong></p><ul>${placeDetails.opening_hours.weekday_text.map(day => `<li>${day}</li>`).join('')}</ul>`,
    placeDetails.photos?.[0] && `<img src="${placeDetails.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })}" alt="${placeDetails.name}" style="width:100%;max-width:300px;margin-top:10px;">`
  ].filter(Boolean);

  return `<div class="place-details-info">${sections.join('')}</div>`;
}

// Map and visualization functions
function createCustomMarkerElement(type, label) {
  const cacheKey = `${type}-${label}`;
  if (markersCache.has(cacheKey)) {
    return markersCache.get(cacheKey).cloneNode(true);
  }

  const markerElement = document.createElement("div");
  Object.assign(markerElement.style, {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    backgroundColor: type === "visit" ? "#4285F4" : "#FF0000",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "14px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
    transition: "transform 0.2s ease"
  });
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

    infoWindow = new google.maps.InfoWindow();
  } catch (error) {
    console.error("Error initializing map:", error);
  }
}

function clearMap() {
  [...markers, ...polylines].forEach(item => item.setMap(null));
  markers = [];
  polylines = [];
  animationPath = [];
  animationPolyline?.setPath([]);
  infoWindow?.close();
}

async function renderPoint(point, index, opacity = 1.0) {
  const markerElement = createCustomMarkerElement(point.type, index + 1);
  
  if (point.type === "visit") {
    const marker = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: point.latitude, lng: point.longitude },
      map,
      content: markerElement
    });
    markers.push(marker);

    if (point.placeId) {
      marker.addListener('gmp-click', async () => {
        infoWindow.setContent('<div style="text-align:center;padding:10px;">Loading place details...</div>');
        infoWindow.open(map, marker);
        
        const placeDetails = await fetchPlaceDetails(point.placeId);
        const content = placeDetails 
          ? createPlaceDetailsInfoWindow(placeDetails)
          : `<div style="text-align:center;padding:10px;"><strong>${point.name || "Unknown Location"}</strong><br>No additional details available</div>`;
        infoWindow.setContent(content);
      });
    }
  } else if (point.type === "activity") {
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

    const startMarker = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: point.start_latitude, lng: point.start_longitude },
      map,
      content: markerElement
    });
    markers.push(startMarker);
  }
}

function stopAnimation() {
  isPlaying = false;
  clearInterval(animationInterval);
  document.getElementById("playBtn").textContent = "Play Timeline";
  const datePicker = document.getElementById("datePicker");
  loadTimelineDataForDate(moment(datePicker.value));
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

    renderPoint(item, currentAnimationIndex);

    if (item.type === "visit") {
      animationPath.push({ lat: item.latitude, lng: item.longitude });
    } else if (item.type === "activity") {
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

  animationInterval = setInterval(animate, 1000);
  animate();
}

// Timeline UI functions
function createTimelineItem(item, index) {
  const timelineItem = document.createElement("div");
  timelineItem.className = "timeline-item";
  timelineItem.dataset.index = index;

  const coordinates = item.type === "visit" 
    ? { lat: item.latitude, lng: item.longitude }
    : { lat: item.start_latitude, lng: item.start_longitude };
  
  const timezone = detectTimezone(coordinates);
  const startTime = formatTimeWithTimezone(item.start_time, timezone);
  const endTime = formatTimeWithTimezone(item.end_time, timezone);
  const duration = formatDuration(item.start_time, item.end_time);

  const markerNumber = document.createElement("div");
  markerNumber.className = "marker-number";
  markerNumber.textContent = (index + 1).toString();
  markerNumber.style.backgroundColor = item.type === "visit" ? "#4285F4" : "#FF0000";

  const contentDiv = document.createElement("div");
  contentDiv.className = "timeline-content";
  
  const displayName = item.type === "visit" 
    ? (item.name || "Unknown Location")
    : (item.activity || "Movement");
  
  contentDiv.innerHTML = `
    <strong>${displayName}</strong><br>
    ${startTime} - ${endTime} (${duration})<br>
  `;

  timelineItem.append(markerNumber, contentDiv);
  
  timelineItem.addEventListener('click', () => {
    document.querySelectorAll('.timeline-item').forEach(item => {
      item.classList.remove('highlighted');
    });
    timelineItem.classList.add('highlighted');
    
    if (item.type === "visit") {
      map.setCenter({ lat: item.latitude, lng: item.longitude });
      map.setZoom(15);
    } else if (item.type === "activity") {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: item.start_latitude, lng: item.start_longitude });
      bounds.extend({ lat: item.end_latitude, lng: item.end_longitude });
      map.fitBounds(bounds, { padding: 50 });
    }
  });

  return timelineItem;
}

function updateTimelineItemWithPlaceDetails(item, timelineItem, placeDetails) {
  const detailsButton = document.createElement('button');
  detailsButton.className = 'details-button';
  detailsButton.textContent = 'View Details';
  detailsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    showPlaceDetailsModal(placeDetails);
  });

  timelineItem.appendChild(detailsButton);
  timelineItem.classList.add('has-details');

  if (placeDetails.name && placeDetails.name !== item.name) {
    const nameElement = timelineItem.querySelector('strong');
    if (nameElement) {
      nameElement.textContent = placeDetails.name;
    }
  }
}

function showPlaceDetailsModal(placeDetails) {
  const modal = document.createElement('div');
  modal.className = 'place-details-modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const closeButton = document.createElement('span');
  closeButton.className = 'close-button';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => document.body.removeChild(modal));

  const contentContainer = document.createElement('div');
  contentContainer.innerHTML = createPlaceDetailsInfoWindow(placeDetails);

  modalContent.append(closeButton, contentContainer);
  modal.appendChild(modalContent);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) document.body.removeChild(modal);
  });

  document.body.appendChild(modal);

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

const debouncedLoadTimelineData = debounce(loadTimelineDataForDate, 250);

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
    const placeDetailsPromises = [];

    relevantData.forEach((item, index) => {
      const timelineItem = createTimelineItem(item, index);
      fragment.appendChild(timelineItem);

      if (item.type === "visit" && item.placeId) {
        const detailsPromise = fetchPlaceDetails(item.placeId).then(details => {
          if (details) {
            updateTimelineItemWithPlaceDetails(item, timelineItem, details);
          }
          return { index, details };
        });
        placeDetailsPromises.push(detailsPromise);
      }

      renderPoint(item, index);

      // Update bounds
      const coordinates = item.type === "visit"
        ? [{ lat: item.latitude, lng: item.longitude }]
        : [
            { lat: item.start_latitude, lng: item.start_longitude },
            { lat: item.end_latitude, lng: item.end_longitude }
          ];
      
      coordinates.forEach(coord => bounds.extend(coord));
      hasValidPoints = true;
    });

    document.getElementById("timeline").appendChild(fragment);

    if (hasValidPoints) {
      map.fitBounds(bounds, { padding: 50 });
    }

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

// Event handlers
function setupEventHandlers() {
  const datePicker = document.getElementById("datePicker");
  datePicker.value = moment().format("YYYY-MM-DD");

  const eventHandlers = [
    { id: "datePicker", event: "change", handler: () => debouncedLoadTimelineData(moment(datePicker.value)) },
    { id: "prevDayBtn", event: "click", handler: () => {
      const selectedDate = moment(datePicker.value).subtract(1, "days");
      datePicker.value = selectedDate.format("YYYY-MM-DD");
      debouncedLoadTimelineData(selectedDate);
    }},
    { id: "nextDayBtn", event: "click", handler: () => {
      const selectedDate = moment(datePicker.value).add(1, "days");
      datePicker.value = selectedDate.format("YYYY-MM-DD");
      debouncedLoadTimelineData(selectedDate);
    }},
    { id: "playBtn", event: "click", handler: async () => {
      const selectedDate = moment(datePicker.value);
      const relevantData = await loadTimelineDataForDate(selectedDate);
      playTimeline(relevantData);
    }}
  ];

  eventHandlers.forEach(({ id, event, handler }) => {
    document.getElementById(id).addEventListener(event, handler);
  });

  document.addEventListener('keydown', (e) => {
    const keyHandlers = {
      'ArrowLeft': () => document.getElementById("prevDayBtn").click(),
      'ArrowRight': () => document.getElementById("nextDayBtn").click(),
      ' ': (e) => {
        e.preventDefault();
        document.getElementById("playBtn").click();
      }
    };
    
    if (keyHandlers[e.key]) {
      keyHandlers[e.key](e);
    }
  });
}

function createTimeFormatToggle() {
  const timeFormatToggle = document.createElement("button");
  timeFormatToggle.id = "timeFormatToggle";
  timeFormatToggle.className = "control-button";
  timeFormatToggle.textContent = "24h Format: OFF";
  
  timeFormatToggle.addEventListener("click", async () => {
    use24HourFormat = !use24HourFormat;
    timeFormatToggle.textContent = `24h Format: ${use24HourFormat ? "ON" : "OFF"}`;
    const selectedDate = moment(document.getElementById("datePicker").value);
    await debouncedLoadTimelineData(selectedDate);
  });

  const controlsElement = document.querySelector(".controls") || (() => {
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "controls";
    document.querySelector(".controls-container").appendChild(controlsDiv);
    return controlsDiv;
  })();

  controlsElement.appendChild(timeFormatToggle);
}

// Initialization
window.onload = async () => {
  try {
    initMap();
    createTimeFormatToggle();
    setupEventHandlers();
    await loadLocationHistory();
  } catch (error) {
    console.error("Error initializing application:", error);
  }
};