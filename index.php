<?php

require('conf.php');

?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Location Timeline Viewer</title>
  <script src="https://maps.googleapis.com/maps/api/js?key=<?= $apikey ?>&libraries=marker,places"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.43/moment-timezone-with-data.min.js"></script>
  <link rel="stylesheet" href="styles.css">
    <script>
    </script>
</head>

<body>
  <div id="container">
    <div id="sidebar">
      <div id="datePickerContainer">
        <button id="prevDayBtn" class="nav-btn" title="Previous Day (Left Arrow)">&lt;</button>
        <input type="date" id="datePicker" class="date-input">
        <button id="nextDayBtn" class="nav-btn" title="Next Day (Right Arrow)">&gt;</button>
      </div>

      <div class="controls-container">
        <button id="playBtn" class="control-btn" title="Play/Stop (Spacebar)">
          <span class="btn-icon">▶</span>
          <span class="btn-text">Play Timeline</span>
        </button>
        <div class="controls"></div>
      </div>

      <div id="timeline-container">
        <div id="timeline-header">
          <h3>Timeline Events</h3>
          <div class="legend">
            <span class="legend-item">
              <span class="dot visit"></span> Visit
            </span>
            <span class="legend-item">
              <span class="dot activity"></span> Activity
            </span>
          </div>
        </div>
        <div id="timeline"></div>
      </div>
    </div>

    <div id="map-container">
      <div id="map"></div>
      <div id="map-loading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <span>Loading map data...</span>
      </div>
    </div>
  </div>

  <div id="tooltip" class="tooltip"></div>

  <script src="timeline-viewer.js"></script>
</body>
</html>
