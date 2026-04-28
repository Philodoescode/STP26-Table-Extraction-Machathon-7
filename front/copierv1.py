#!/usr/bin/env python3

import os
import argparse
from pathlib import Path

DEFAULT_OUTPUT_FILENAME = "compiled_code.txt"
DEFAULT_PROG_FILENAME = "copierv1.py"
DEFAULT_EXTENSIONS = [
    ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".scss", ".java",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".go", ".rs", ".swift", ".kt", ".php",
    ".rb", ".pl", ".sh", ".md", ".txt", ".json", ".xml", ".yaml", ".yml",
    ".sql", ".prisma" # Add or remove extensions as needed
]
EXCLUDE_DIRS = [".git", ".vscode", ".idea", "node_modules", "__pycache__", "venv", ".env", "build", "dist", "cmake-build-debug", "ui", ".next"]
EXCLUDE_FILES = [DEFAULT_OUTPUT_FILENAME, DEFAULT_PROG_FILENAME, "README.md", "next-env.d.ts", "opencv.js"] # Initially, just exclude the output file itself

def compile_project_to_text(project_dir: Path, output_file_name: str, extensions: list, exclude_dirs: list, exclude_files: list):
    """
    Compiles content of all source files in a project directory into a single text file.
    """
    output_path = project_dir / output_file_name
    # Add the resolved output path to exclude_files to prevent self-inclusion if run multiple times
    # or if the output file name is changed via argument but an old one exists.
    current_exclude_files = exclude_files + [output_file_name]


    if not project_dir.is_dir():
        print(f"Error: Project directory '{project_dir}' not found or is not a directory.")
        return

    print(f"Scanning directory: {project_dir.resolve()}")
    print(f"Looking for extensions: {', '.join(extensions)}")
    print(f"Excluding directories: {', '.join(exclude_dirs)}")
    print(f"Excluding files: {', '.join(current_exclude_files)}")
    print(f"Output will be written to: {output_path.resolve()}")

    source_files_found = []

    for item in project_dir.rglob("*"): # rglob searches recursively
        if item.is_file():
            # Check if file should be excluded by name
            if item.name in current_exclude_files:
                # print(f"Skipping excluded file: {item.name}")
                continue

            # Check if file is in an excluded directory
            in_excluded_dir = False
            for excluded in exclude_dirs:
                if excluded in item.parts: # Check if any part of the path matches an excluded dir name
                    in_excluded_dir = True
                    break
            if in_excluded_dir:
                # print(f"Skipping file in excluded directory: {item}")
                continue

            # Check if file has one of the desired extensions
            if item.suffix.lower() in extensions:
                source_files_found.append(item)
        # If item is a directory, check if it's an excluded directory to skip rglobbing into it
        # Note: pathlib's rglob doesn't have a direct way to prune directories like os.walk.
        # The check above for `excluded in item.parts` for files handles this sufficiently for many cases.
        # For more complex exclusion patterns, os.walk might be preferred.

    if not source_files_found:
        print("No source files found matching the criteria.")
        return

    source_files_found.sort() # Sort for consistent order

    try:
        with open(output_path, "w", encoding="utf-8") as outfile:
            outfile.write("//MY CODE\n")
            for file_path in source_files_found:
                relative_path = file_path.relative_to(project_dir)
                header = f"//START OF {relative_path}\n" # Changed to include relative path
                print(f"Processing: {relative_path}")
                outfile.write(header)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="replace") as infile:
                        outfile.write(infile.read())
                    outfile.write("\n//END OF " + str(relative_path) + "\n\n") # Ensure a newline after content
                except Exception as e:
                    outfile.write(f"//ERROR READING FILE: {relative_path} - {e}\n")
                    outfile.write("\n//END OF " + str(relative_path) + " (WITH ERROR)\n\n")
            outfile.write("//END OF FILES\n")
        print(f"\nSuccessfully compiled {len(source_files_found)} files into '{output_path.resolve()}'")
    except IOError as e:
        print(f"Error writing to output file '{output_path}': {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compile project source files into a single text file.")
    parser.add_argument(
        "project_directory",
        type=str,
        nargs="?", # Makes the argument optional
        default=".", # Default to current directory
        help="The path to the project directory (default: current directory)."
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=DEFAULT_OUTPUT_FILENAME,
        help=f"Name of the output file (default: {DEFAULT_OUTPUT_FILENAME}). Will be placed in the project directory."
    )
    parser.add_argument(
        "-e", "--extensions",
        type=str,
        nargs="+", # Allows multiple extensions
        default=DEFAULT_EXTENSIONS,
        help=f"List of file extensions to include (e.g., .py .js .cpp). Default is a common list."
    )
    parser.add_argument(
        "--exclude-dirs",
        type=str,
        nargs="+",
        default=EXCLUDE_DIRS,
        help="List of directory names to exclude (e.g., node_modules .git)."
    )
    parser.add_argument(
        "--exclude-files",
        type=str,
        nargs="+",
        default=EXCLUDE_FILES, # This will be initially empty from default, output file added programmatically
        help="List of specific file names to exclude (e.g., secret.txt config.json)."
    )

    args = parser.parse_args()

    # Ensure extensions start with a dot and are lowercase for consistent matching
    processed_extensions = [ext if ext.startswith('.') else '.' + ext for ext in args.extensions]
    processed_extensions = [ext.lower() for ext in processed_extensions]

    # Add the chosen output filename to the exclude_files list (if not already there)
    # This ensures the script doesn't try to include its own output from a previous run.
    final_exclude_files = list(set(args.exclude_files + [args.output]))


    project_path = Path(args.project_directory).resolve()

    compile_project_to_text(project_path, args.output, processed_extensions, args.exclude_dirs, final_exclude_files)