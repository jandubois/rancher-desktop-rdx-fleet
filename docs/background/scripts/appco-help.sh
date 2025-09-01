#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND_DIR="$(dirname "$SCRIPT_DIR")"

OUTPUT_DIR="${BACKGROUND_DIR}/appco-help"
wget -r -np -k -P "$OUTPUT_DIR" --no-host-directories -A "*.html,*.htm" --level=5 --wait=1 \
  https://docs.apps.rancher.io/

cd "$OUTPUT_DIR"

# Convert HTML to markdown with cleanup options
find . -name "*.html" | while read file; do
    # Use GitHub Flavored Markdown with better preservation of structure
    pandoc -f html -t gfm --wrap=none --strip-comments \
        --markdown-headings=atx \
        --standalone \
        "$file" -o "${file%.*}.md"
    echo "Converted: $file"
done

# Clean up the markdown files to remove HTML divs and fix links
echo "Cleaning up markdown formatting..."
find . -name "*.md" | while read mdfile; do
    # Remove HTML div tags (opening and closing)
    sed -i '' -E 's|<div[^>]*>||g' "$mdfile"
    sed -i '' -E 's|</div>||g' "$mdfile"
    
    # Remove other HTML tags that might be left over
    sed -i '' -E 's|<span[^>]*>||g' "$mdfile"
    sed -i '' -E 's|</span>||g' "$mdfile"
    
    # Remove pandoc div syntax with CSS classes (if any remain)
    sed -i '' -E '/^:{3,} \{[^}]*\}$/d' "$mdfile"
    sed -i '' -E '/^:{3,}$/d' "$mdfile"
    
    # Convert external docs.apps.rancher.io links to local links
    sed -i '' -E 's|https://docs\.apps\.rancher\.io/([^)]*)|./\1|g' "$mdfile"
    # Clean up the "./" prefix but preserve directory structure
    sed -i '' -E 's|\]\(\./([^)]*)\)|\]\(\1\)|g' "$mdfile"
    
    # Remove excessive empty lines (more than 2 consecutive)
    awk '/^$/{++n} /^./{n=0} {if(n<=2) print}' "$mdfile" > "${mdfile}.tmp" && mv "${mdfile}.tmp" "$mdfile"
done

# Rename index.md files to directory-name.md and update links
find . -name "index.md" | while read indexfile; do
    dir=$(dirname "$indexfile")
    if [ "$dir" != "." ]; then
        dirname_only=$(basename "$dir")
        newfile="${dir}.md"
        mv "$indexfile" "$newfile"
        echo "Renamed: $indexfile -> $newfile"
        # Remove the now empty directory if it only contained index.md
        if [ -d "$dir" ] && [ -z "$(ls -A "$dir")" ]; then
            rmdir "$dir"
            echo "Removed empty directory: $dir"
        fi
    fi
done

# Update all markdown links to use new naming convention
echo "Updating internal links..."
find . -name "*.md" | while read mdfile; do
    echo "Processing links in: $mdfile"
    
    # Fix links pointing to HTML files to point to markdown files instead
    sed -i '' -E 's|\]\(([^)]+)\.html\)|\]\(\1.md\)|g' "$mdfile"
    
    # Fix links pointing to index.html to use directory name
    sed -i '' -E 's|\]\(([^)]+)/index\.html\)|\]\(\1.md\)|g' "$mdfile"
    
    # Fix links pointing to index.md to use directory name  
    sed -i '' -E 's|\]\(([^)]+)/index\.md\)|\]\(\1.md\)|g' "$mdfile"
    
    # Fix links pointing to index (without extension) to use directory name
    sed -i '' -E 's|\]\(([^)]+)/index\)|\]\(\1\)|g' "$mdfile"
done

# After renaming, fix broken relative links in files that were moved from subdirectories
echo "Fixing relative links in renamed files..."
find . -maxdepth 1 -name "*.md" | while read mdfile; do
    # Skip index.md (it wasn't renamed)
    if [ "$(basename "$mdfile")" = "index.md" ]; then
        continue
    fi
    
    # Check if this was likely a renamed index.md file (has a corresponding directory)
    basename_no_ext=$(basename "$mdfile" .md)
    if [ -d "$basename_no_ext" ]; then
        echo "Fixing links in renamed file: $mdfile (was $basename_no_ext/index.md)"
        
        # Find all .md files in the corresponding directory
        find "$basename_no_ext" -name "*.md" | while read target_file; do
            # Get just the filename from the path
            target_filename=$(basename "$target_file")
            
            # Replace links that point to this file (without directory prefix)
            # Only replace if the link doesn't already have a directory prefix
            sed -i '' "s|\]($target_filename)|\]($target_file)|g" "$mdfile"
        done
        
        echo "Fixed links in $mdfile for directory $basename_no_ext"
    fi
done

# Clean up HTML files
find . -name "*.html" -delete
echo "Cleaned up HTML files"

# Clean up all empty directories (run multiple times to handle nested empty dirs)
echo "Cleaning up empty directories..."
for i in {1..5}; do
    find . -type d -empty -delete 2>/dev/null || true
done
echo "Empty directories cleaned up"

# Add missing section links to main index.md
echo "Adding section links to main index.md..."
if [ -f "./index.md" ]; then
    # Check if section links are already present
    if ! grep -q "### \[Get started\]" ./index.md; then
        # Find the line with "Here you will familiarize" and add links after it
        sed -i '' '/Here you will familiarize/a\
\
\
------------------------------------------------------------------------\
\
\
### [Get started](get-started.md)\
\
###### This section of the documentation contains a set of articles that will help you understand how the Application Collection works and how to start using it\
\
\
### [How-to guides](howto-guides.md)\
\
###### In this part of the documentation site, you will find *How-to* guides for using the Application Collection\
\
\
### [Reference guides](reference-guides.md)\
\
###### Here you will learn how to use the key applications\
\
' ./index.md
        echo "Added section links to index.md"
    else
        echo "Section links already exist in index.md"
    fi
fi

echo "Done! Markdown files saved in $OUTPUT_DIR with proper naming"