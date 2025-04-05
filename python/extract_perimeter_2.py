import csv
import json
from shapely.geometry import box, MultiPolygon, Polygon
from shapely.ops import unary_union
from shapely.validation import make_valid  # To help clean geometries
import sys
import logging  # Using logging for better messages

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def create_geojson_from_csv_overall_perimeter(csv_filepath, geojson_filepath):
    """
    Reads a CSV file with tile boundaries, calculates the SINGLE outer perimeter
    for ALL tiles using a buffer strategy, and writes a GeoJSON file 
    containing one feature for the overall boundary.

    Args:
        csv_filepath (str): Path to the input CSV file.
        geojson_filepath (str): Path for the output GeoJSON file.
    """

    # Store all valid tile geometries in a single list
    all_tile_geoms = [] 
    required_headers = {"lat_min", "lat_max", "lon_min", "lon_max"}
    # Buffer amount (1e-7 seemed okay for intra-row merging, should work here too)
    BUFFER_EPSILON = 1e-7 
    total_tiles_processed = 0 # Keep track of total tiles read

    logging.info(f"Reading CSV file: {csv_filepath}")
    try:
        with open(csv_filepath, mode="r", newline="", encoding="utf-8") as infile:
            reader = csv.DictReader(infile)

            if not required_headers.issubset(reader.fieldnames):
                missing = required_headers - set(reader.fieldnames)
                logging.error(f"Missing required columns in CSV: {missing}")
                sys.exit(1)

            for i, record in enumerate(reader):
                try:
                    # Create a Shapely box (polygon) for each tile
                    tile_geom = box(
                        float(record["lon_min"]),
                        float(record["lat_min"]),
                        float(record["lon_max"]),
                        float(record["lat_max"]),
                    )
                    # Basic check for validity before adding
                    if not tile_geom.is_valid:
                        logging.warning(
                            f"Skipping invalid geometry from CSV row {i+1}: {record}"
                        )
                        continue
                    
                    # Add the valid geometry to the single list
                    all_tile_geoms.append(tile_geom) 
                    total_tiles_processed += 1

                except (ValueError, TypeError) as e:
                    logging.warning(
                        f"Skipping CSV row {i+1} due to invalid number format: {e} - Record: {record}"
                    )
                except KeyError as e:
                    logging.warning(
                        f"Skipping CSV row {i+1} due to missing key: {e} - Record: {record}"
                    )

    except FileNotFoundError:
        logging.error(f"Input CSV file not found at {csv_filepath}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Error reading CSV file: {e}")
        sys.exit(1)

    # Check if any valid geometries were collected
    if not all_tile_geoms:
        logging.error("No valid tile data found or processed from the CSV file.")
        sys.exit(1)

    logging.info(f"Collected {len(all_tile_geoms)} valid tile geometries.")
    logging.info("Calculating union of ALL tiles (using buffer +/- strategy)...")

    # --- Perform Buffering Strategy on ALL tiles together ---
    final_geom = None # Initialize final geometry
    try:
        # 1. Buffer each tile slightly outward
        #    Filter out any potential empty geoms first (shouldn't happen with box, but good practice)
        valid_initial_geoms = [g for g in all_tile_geoms if not g.is_empty]
        if not valid_initial_geoms:
             logging.error("No non-empty geometries found before buffering, exiting.")
             sys.exit(1)

        # Apply positive buffer individually and clean
        buffered_geoms = []
        for geom in valid_initial_geoms:
            buffered = geom.buffer(BUFFER_EPSILON)
            cleaned_buffered = make_valid(buffered) # Clean after buffering
            if not cleaned_buffered.is_empty:
                buffered_geoms.append(cleaned_buffered)

        if not buffered_geoms:
            logging.error("No valid geometries remained after positive buffer, exiting.")
            sys.exit(1)

        # 2. Calculate the union of ALL buffered tiles
        logging.info("Performing unary union...")
        unioned_geom = unary_union(buffered_geoms)
        logging.info("Union complete. Cleaning geometry...")

        # Clean the unioned geometry
        unioned_geom = make_valid(unioned_geom.buffer(0)) 
        logging.info("Cleaning complete.")

        # 3. Buffer the result back inward
        if not unioned_geom.is_empty and unioned_geom.geom_type in ("Polygon", "MultiPolygon"):
            logging.info("Performing negative buffer...")
            # Apply negative buffer
            final_geom = unioned_geom.buffer(-BUFFER_EPSILON)
            # Clean up results of negative buffer
            final_geom = make_valid(final_geom.buffer(0))
            logging.info("Negative buffer and final cleaning complete.")
        else:
            # Handle cases where union resulted in something unexpected
            logging.error(
                f"Union resulted in non-polygon geometry ({unioned_geom.geom_type}) or was empty after cleaning steps. Cannot proceed."
            )
            sys.exit(1)

        # Final check for validity and emptiness
        if final_geom.is_empty:
            logging.error("Final geometry is empty after processing, exiting.")
            sys.exit(1)
        if not final_geom.is_valid:
            # Try one last time to fix, otherwise report error
            final_geom = make_valid(final_geom)
            if not final_geom.is_valid:
                logging.error("Final geometry is invalid after all steps, exiting.")
                sys.exit(1)
            else:
                 logging.warning("Final geometry required an extra make_valid step.")


    except Exception as e:
        logging.error(f"Unexpected error during geometry processing: {e}", exc_info=True)
        sys.exit(1)
    # --- End Buffering Strategy ---


    # --- Create GeoJSON Output ---
    # Now we create a FeatureCollection with only ONE feature: the overall perimeter
    feature = {
        "type": "Feature",
        "geometry": final_geom.__geo_interface__,
        "properties": {
            # Add relevant properties, e.g., total original tiles
            "original_tile_count": total_tiles_processed,
            "description": "Overall perimeter of all tiles" 
        }
    }
    
    # The FeatureCollection now contains just the single overall perimeter feature
    feature_collection = {"type": "FeatureCollection", "features": [feature]} 

    logging.info(f"Writing GeoJSON output to: {geojson_filepath}")
    try:
        with open(geojson_filepath, mode="w", encoding="utf-8") as outfile:
            json.dump(feature_collection, outfile, indent=2)
        logging.info("GeoJSON file created successfully with the overall perimeter.")
    except Exception as e:
        logging.error(f"Error writing GeoJSON file: {e}")
        sys.exit(1)


# --- How to use the script ---
if __name__ == "__main__":
    # Define the input CSV file path and the desired output GeoJSON file path
    input_csv = 'data/tile_bounds_coords_adj.csv' 
    # Consider a different output name to avoid confusion with the per-row version
    output_geojson = 'data/tile_perimeter.geojson' 

    # Call the modified function
    create_geojson_from_csv_overall_perimeter(input_csv, output_geojson)
