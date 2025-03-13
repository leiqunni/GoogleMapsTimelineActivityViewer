# Google Maps Timeline Activity Viewer

This tool visualizes Google Maps Timeline data using JSON exported from the Google Maps app on iOS. It includes a handful of improvements and fixes to make it work with the iOS format, building on the original project by [kurupted](https://github.com/kurupted/google-maps-timeline-viewer).


Please be warned that bulk of this is GPT/Claude generated slop on top of the original project


## Instructions

### 1. Clone the Repository

```bash
git clone https://gist.github.com/epk/a70dd9b7a2d5bf8e5d86ebdcaefb6b32
```

### 2. Get Your Google Maps API Key

1. Follow the instructions in [this guide](https://github.com/kurupted/google-maps-timeline-viewer?tab=readme-ov-file#obtain-a-google-maps-api-key) to generate a Google Maps API key.
2. Replace `YOUR_API_KEY` in `index.html` with your API key.

### 3. Create a custom map

1. Create a custom map style by following [this guide](https://developers.google.com/maps/documentation/javascript/cloud-customization/map-styles-leg#create-style).
2. Replace `MY_MAP_ID` in `timeline-viewer.js` with your custom Map ID.

### 4. Add Timeline Data

1. Export your timeline data from the Google Maps app on iOS.
2. Copy the exported JSON file into the project folder.
3. Rename the file to `location-history.json`.

### 5. Run the Viewer

1. Start a local server in the project directory:
   ```bash
   python -m http.server 8000
   ```
2. Open your browser and navigate to [http://localhost:8000](http://localhost:8000).


## Screenshots

![image](https://gist.github.com/user-attachments/assets/c512e4a6-296e-4c7f-a79a-b4b313c7efd3)
