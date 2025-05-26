# Google Maps Timeline Activity Viewer

## Overview
Google Maps Timeline Activity Viewer is a tool that allows you to visualize and analyze your location history data from Google Maps Timeline. You can track your movements, discover patterns in your daily activities, and gain insights from your location history.

![Image](https://github.com/user-attachments/assets/2e48a9c2-60ab-40d1-a0c2-d68a6621b2fb)

## Features
- Visualize your Google Maps Timeline data on a map
- Analyze your activity patterns over time
- Filter data by date ranges, activity types, or locations
- Export filtered data for further analysis
- View statistics about your movements and visited places

## How to Use
1. First, export `location-history.json` from the Google Maps application on your smartphone
2. Clone or download this repository
3. Set up your Google Maps API key in the `index.html` file
4. Start a local web server (see instructions below)
5. Open the application in your browser and import your JSON data
6. Explore your location history through the interactive interface

### Google Maps API Key Setup
1. Open the `index.html` file in a text editor
2. Replace "YOUR API KEY" with your Google Maps API key
3. Save the file

Note: You need a valid Google Maps API key to properly display maps in this application. You can obtain a key from the [Google Cloud Platform Console](https://console.cloud.google.com/).

## Running the Application
You can run it using a built-in web server with PHP.

### For Windows:

#### Using PHP built-in web server:
```
php -S 0.0.0.0:8888
```

After starting the web server, access the application by opening your browser and navigating to:
```
http://localhost:8888/
```

## Data Privacy
This application processes your location data locally on your device. No data is sent to any external servers, ensuring your location history remains private.

## Requirements
- Modern web browser with JavaScript enabled
- Google Maps Timeline data (JSON format)
- Google Maps API key
- PHP for running the local web server

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Contributions
Contributions are welcome! Please feel free to submit a Pull Request.

## Support
If you encounter any issues or have questions, please open an issue on the GitHub repository.

## Changelog
```
Remove code duplication and redundant parts.
```

Main duplications and redundant parts have been removed:

### Key Changes:
1. **Unified Coordinate Parsing**
   * Unified the `parseCoordinates` function and removed duplication in each parser function
2. **Integrated Data Analysis**
   * Unified visit and activity object creation with `createLocationObject` function
   * Integrated parsing of different data formats with `parseDataSegment` function
   * Unified timeline path processing with `parseTimelinePath` function
3. **Reduced Code Duplication**
   * Integrated coordinate boundary extension processing
   * Unified marker creation and clearing processes
   * Array-based event handler setup
4. **Function Simplification**
   * Used array filters for conditional content generation in `createPlaceDetailsInfoWindow`
   * Simplified style settings with `Object.assign`
   * Used spread operator for unified marker and polyline clearing
5. **Optimized Conditional Processing**
   * Utilized ternary operators and Optional chaining
   * Integrated duplicate conditional branches
6. **Structural Improvements**
   * Grouped related functionality
   * Batch event handler setup using arrays
   * Unified initialization processes

This cleanup significantly reduced code size and improved maintainability while preserving all original functionality.
