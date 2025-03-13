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
}

function stopAnimation() {
  isPlaying = false;
  clearInterval(animationInterval);
  document.getElementById("playBtn").textContent = "Play Timeline";
  const datePicker = document.getElementById("datePicker");
  loadTimelineDataForDate(moment(datePicker.value));
}

// Format time with timezone
function formatTimeWithTimezone(timestamp, timezone, format = "hh:mm A z") {
  const tz = timezone || detectTimezone();
  return moment(timestamp).tz(tz).format(format);
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

function renderPoint(point, index, opacity = 1.0) {
  if (point.type === "visit") {
    const markerElement = createCustomMarkerElement("visit", index + 1);
    const marker = new google.maps.marker.AdvancedMarkerElement({
      position: { lat: point.latitude, lng: point.longitude },
      map,
      content: markerElement
    });
    markers.push(marker);
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

    relevantData.forEach((item, index) => {
      // Create timeline item
      const timelineItem = createTimelineItem(item, index);
      fragment.appendChild(timelineItem);

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

    document.getElementById('map-loading').style.display = 'none';
    return relevantData;
  } catch (error) {
    console.error("Error loading timeline data:", error);
    document.getElementById('map-loading').style.display = 'none';
  }
}

function createTimelineItem(item, index) {
  const timelineItem = document.createElement("div");
  timelineItem.className = "timeline-item";
  timelineItem.dataset.index = index;

  const timezone = item.type === "visit"
    ? detectTimezone({ lat: item.latitude, lng: item.longitude })
    : detectTimezone({ lat: item.start_latitude, lng: item.start_longitude });

  const startTime = formatTimeWithTimezone(item.start_time, timezone);
  const endTime = formatTimeWithTimezone(item.end_time, timezone);

  let content = '';
  if (item.type === "visit") {
    content = `
      <strong>${item.name || "Unknown Location"}</strong><br>
      ${startTime} - ${endTime}
    `;
  } else if (item.type === "activity") {
    content = `
      <strong>${item.activity || "Movement"}</strong><br>
      ${startTime} - ${endTime}
    `;
  }

  timelineItem.innerHTML = content;
  timelineItem.addEventListener('click', () => {
    if (item.type === "visit") {
      map.panTo({ lat: item.latitude, lng: item.longitude });
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

window.onload = async () => {
  try {
    initMap();

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
