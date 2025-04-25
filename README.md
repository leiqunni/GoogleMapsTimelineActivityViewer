# Google Maps Timeline Activity Viewer

## Overview
Google Maps Timeline Activity Viewer is a tool that allows you to visualize and analyze your location history data from Google Maps Timeline. You can track your movements, discover patterns in your daily activities, and gain insights from your location history.

## Features
- Visualize your Google Maps Timeline data on a map
- Analyze your activity patterns over time
- Filter data by date ranges, activity types, or locations
- Export filtered data for further analysis
- View statistics about your movements and visited places

## How to Use
1. First, download your Google Maps Timeline data from Google Takeout
2. Clone or download this repository
3. Configure your Google Maps API key in the `conf.php` file
4. Launch a local web server (see instructions below)
5. Open the application in your browser and import your JSON data
6. Explore your location history through the interactive interface

### Google Maps API Key Setup
1. Open the `conf.php` file in a text editor
2. Find the API key configuration section
3. Enter your Google Maps API key in the designated field
4. Save the file

Note: You need a valid Google Maps API key to properly display maps in this application. You can obtain a key from the [Google Cloud Platform Console](https://console.cloud.google.com/).

## Running the Application
This application doesn't require Node.js. You can run it using a built-in web server with PHP or Python.

### For Windows:

#### Using PHP built-in web server:
```
php -S 0.0.0.0:8888
```

#### Using Python built-in web server:
```
python -m http.server 8888
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
- PHP or Python for running the local web server

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Contributions
Contributions are welcome! Please feel free to submit a Pull Request.

## Support
If you encounter any issues or have questions, please open an issue on the GitHub repository.
