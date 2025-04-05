# Filename: strip_geojson_geometry.py

import json
import os

# --- Configuration ---
# Set the input GeoJSON file path
input_geojson_path = 'data/buildings_with_labels.geojson'
# Set the desired output file path
output_geojson_path = 'data/buildings_with_labels_stripped.geojson'
# --- End Configuration ---

def strip_geometry(input_path, output_path):
    """
    Reads a GeoJSON FeatureCollection, removes the 'geometry' field 
    from each feature, and writes the result to a new file.

    Args:
        input_path (str): Path to the input GeoJSON file.
        output_path (str): Path where the output GeoJSON file will be saved.
    """
    print(f"Reading GeoJSON file: {input_path}")
    
    try:
        # Open and load the input GeoJSON file
        with open(input_path, 'r', encoding='utf-8') as infile:
            data = json.load(infile)

        # Basic validation: Check if it's a FeatureCollection with features
        if not isinstance(data, dict) or data.get('type') != 'FeatureCollection' or 'features' not in data:
            print("Error: Input file is not a valid GeoJSON FeatureCollection.")
            return

        # Create the structure for the output GeoJSON
        output_data = {
            "type": "FeatureCollection",
            "features": []
        }
        
        # Optional: Copy other top-level members if they exist (like 'crs' or 'bbox')
        for key, value in data.items():
            if key not in ['type', 'features']:
                output_data[key] = value

        print(f"Processing {len(data['features'])} features...")

        # Iterate through each feature in the original data
        for feature in data['features']:
            if not isinstance(feature, dict) or feature.get('type') != 'Feature':
                print("Warning: Skipping invalid feature structure.")
                continue

            # Create a new feature dictionary, excluding 'geometry'
            new_feature = {
                "type": "Feature",
                # Include 'id' if it exists at the feature level
                **({"id": feature["id"]} if "id" in feature else {}),
                # Always include 'properties'
                "properties": feature.get("properties", {}) # Use .get for safety
            }
            # Append the geometry-stripped feature to our output list
            output_data['features'].append(new_feature)

        # Ensure the output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir: # Check if path includes a directory
             os.makedirs(output_dir, exist_ok=True) # Create directory if it doesn't exist

        print(f"Writing processed data to: {output_path}")
        # Open the output file and write the modified data
        with open(output_path, 'w', encoding='utf-8') as outfile:
            # Use separators=(',', ':') for the most compact output
            # Use indent=2 for readable output (larger file size)
            json.dump(output_data, outfile, separators=(',', ':')) 
            # json.dump(output_data, outfile, indent=2) # Alternative for readability

        print("Processing complete.")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_path}")
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {input_path}. Check file format.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# --- Main execution ---
if __name__ == "__main__":
    # Make sure the paths are correctly specified relative to where you run the script
    # If the script is in the root folder and data is in a 'data' subfolder:
    script_dir = os.path.dirname(__file__) # Gets the directory where the script is located
    
    # Construct absolute paths if needed, assuming 'data' is relative to script dir
    # If input/output paths are already correct relative to execution location, you can skip this
    # input_geojson_path = os.path.join(script_dir, input_geojson_path)
    # output_geojson_path = os.path.join(script_dir, output_geojson_path)

    strip_geometry(input_geojson_path, output_geojson_path)
# --- End Main execution ---