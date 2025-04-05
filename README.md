# Building Damage Assessment using Machine Vision

This project visualizes building damage from satellite imagery using interactive maps and data visualization tools.

## Running the Site

This site uses fetch API to load data from local files, which requires a web server to function properly.

### Option 1: Using Python's built-in HTTP server (recommended)

If you have Python installed (most macOS and Linux systems do), you can start a simple HTTP server:

1. Open a terminal/command prompt
2. Navigate to the project folder:
   ```
   cd path/to/cv-building-damage-method-site
   ```
3. Start the server:
   ```
   python -m http.server
   ```
   (If you have Python 3 installed but the 'python' command doesn't work, try `python3 -m http.server` instead)
4. Open your browser and go to:
   ```
   http://localhost:8000
   ```

### Option 2: Using Node.js's http-server

If you have Node.js installed, you can use http-server:

1. Install http-server globally if you haven't already:
   ```
   npm install -g http-server
   ```
2. Navigate to the project folder in terminal/command prompt
3. Run the server:
   ```
   http-server
   ```
4. Visit the URL shown in the terminal (usually http://localhost:8080)

### Option 3: Using VS Code Live Server

If you're using Visual Studio Code:

1. Install the "Live Server" extension
2. Right-click on index.html in the file explorer
3. Select "Open with Live Server"
4. Your default browser should open automatically

## Troubleshooting

### CORS Errors

If you see errors like:
```
Access to fetch at 'file:///path/to/data.json' from origin 'null' has been blocked by CORS policy
```

This means you're trying to open the HTML file directly in your browser without using a web server. Use one of the methods above to serve the files properly.

### Data Not Loading

The site requires the data files to be in the correct locations:
- GeoJSON data files should be in the `data/` directory
- Make sure permissions are set correctly (files should be readable)

## Project Structure

- `index.html` - Main page
- `css/styles.css` - Styling
- `assets/js/maps/damage-map.js` - Map initialization code
- `data/buildings_with_labels.geojson` - Building damage data

## Browser Compatibility

This site is designed to work with modern browsers (Chrome, Firefox, Safari, Edge). 