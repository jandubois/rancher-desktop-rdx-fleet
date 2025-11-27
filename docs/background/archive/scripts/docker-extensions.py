#!/usr/bin/env python3
import os
import re
import urllib.request
from urllib.parse import urlparse, urljoin

visited = set()

def url_to_local_path(url):
    """Convert any Docker docs URL to local file path"""
    parsed = urlparse(url)
    path = parsed.path
    
    # Remove /extensions/ prefix
    if path.startswith('/extensions/'):
        path = path[12:]  # len('/extensions/') = 12
    elif path == '/extensions':
        path = ''
    
    # Handle empty path (root)
    if not path:
        return 'index.md'
    
    # If it's already a file with extension (like .webp, .png), keep as is
    if '.' in path.split('/')[-1] and not path.endswith('/'):
        return path
    
    # If it's already a .md file, keep as is
    if path.endswith('.md'):
        return path
        
    # For directory URLs, convert to flat file structure
    if path.endswith('/'):
        path = path[:-1]  # Remove trailing slash
    
    # Convert directory path to filename
    if path:
        return path + '.md'
    else:
        return 'index.md'

def rewrite_content(content, base_url):
    """Rewrite Docker extension links to local paths in actual content only"""
    def replace_link(match):
        url = match.group(1)
        
        # Convert relative URLs to absolute
        if url.startswith('../') or not url.startswith('http'):
            url = urljoin(base_url, url)
        
        # Only process Docker extension URLs
        if url.startswith('https://docs.docker.com/extensions/'):
            local_path = url_to_local_path(url)
            return match.group(0).replace(match.group(1), "./" + local_path)
        
        return match.group(0)
    
    # Replace markdown links and fix _index.md references
    content = re.sub(r'\]\(([^)]+)\)', replace_link, content)
    content = re.sub(r'_index\.md', '.md', content)  # Fix _index.md references to .md
    content = re.sub(r'/\.md', r'.md', content)  # Fix /.md to .md (remove slash)
    content = re.sub(r'\.webp\.md', r'.webp', content)  # Fix image extensions
    
    # For now, just fix the obvious broken docs.docker.com links to point to local paths
    # We'll create missing index pages later
    content = re.sub(r'\[([^\]]+)\]\(https://docs\.docker\.com\)', r'[\1](./\1.md)', content)
    content = re.sub(r'\[(Part one: Build)\]\(\./Part one: Build\.md\)', r'[\1](./extensions-sdk/build.md)', content)
    content = re.sub(r'\[(Developer Guides)\]\(\./Developer Guides\.md\)', r'[\1](./extensions-sdk/guides.md)', content)  
    content = re.sub(r'\[(Developer SDK tools)\]\(\./Developer SDK tools\.md\)', r'[\1](./extensions-sdk/dev.md)', content)
    
    return content

def extract_docker_extension_urls(content, base_url):
    """Extract all Docker extension URLs from content"""
    urls = set()
    
    # Find all URLs in the content
    patterns = [
        r'https://docs\.docker\.com/extensions/[^\s\)<>"\']+',
        r'href=["\']([^"\']*docs\.docker\.com/extensions/[^"\']*)["\']',
        r'\]\(([^)]*docs\.docker\.com/extensions/[^)]*)\)',
        r'\]\(([^)]*\.md)\)',  # relative .md links
        r'\]\((\.\./[^)]+)\)', # relative .. links
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, content)
        for match in matches:
            url = match if isinstance(match, str) else match
            
            # Convert relative to absolute
            if not url.startswith('http'):
                url = urljoin(base_url, url)
            
            # Only keep Docker extension URLs that are pages (not images)
            if (url.startswith('https://docs.docker.com/extensions/') and 
                not re.search(r'\.(png|jpg|jpeg|gif|webp|svg|css|js)(\?|#|$)', url)):
                # Clean up URL
                url = re.sub(r'[<>"\']+$', '', url)
                if len(url) < 200:  # Sanity check
                    urls.add(url)
    
    return urls

def download_and_parse(url):
    if url in visited:
        return
    visited.add(url)

    # First, fetch the HTML version to discover links
    html_url = url.rstrip('/').rstrip('.md') + '/' if not url.endswith('/') else url
    print(f"Discovering links from: {html_url}")
    try:
        with urllib.request.urlopen(html_url) as response:
            html_content = response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching HTML from {html_url}: {e}")
        html_content = ""

    # Then download the actual markdown content
    if url.endswith('.md'):
        md_url = url
    elif url.endswith('/'):
        md_url = url + 'index.md'
    else:
        # Remove fragments and query params for clean URLs
        clean_url = url.split('#')[0].split('?')[0]
        md_url = clean_url + '/index.md'
    
    print(f"Downloading markdown: {md_url}")
    try:
        with urllib.request.urlopen(md_url) as response:
            md_content = response.read().decode('utf-8')
        
        # Skip if we accidentally got HTML content
        if md_content.strip().startswith('<!doctype html>'):
            print(f"  Warning: Got HTML instead of markdown from {md_url}, skipping")
            return
            
    except Exception as e:
        print(f"Error downloading markdown from {md_url}: {e}")
        return

    # Save the markdown file (relative to script location)
    local_path = url_to_local_path(url)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)  # Go up one level from scripts/
    save_path = os.path.join(base_dir, "docker-extensions", local_path) if local_path else os.path.join(base_dir, "docker-extensions", "index.md")
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    # Rewrite markdown content and save
    rewritten_content = rewrite_content(md_content, url)
    with open(save_path, "w", encoding="utf-8") as f:
        f.write(rewritten_content)

    # Find links from both HTML and markdown content
    html_urls = extract_docker_extension_urls(html_content, url) if html_content else set()
    md_urls = extract_docker_extension_urls(md_content, url)
    all_urls = html_urls.union(md_urls)
    
    for link_url in all_urls:
        download_and_parse(link_url)

def create_missing_index_pages(base_path):
    """Create index pages for directories that are linked to but don't have index files"""
    import glob
    
    # Find all markdown files
    all_md_files = set()
    for md_file in glob.glob(os.path.join(base_path, "**/*.md"), recursive=True):
        # Convert to relative path from base_path
        rel_path = os.path.relpath(md_file, base_path)
        all_md_files.add(rel_path)
    
    # Find all links in all files
    missing_targets = set()
    for md_file in glob.glob(os.path.join(base_path, "**/*.md"), recursive=True):
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find local markdown links
            links = re.findall(r'\]\(\./([^)]+\.md)\)', content)
            for link in links:
                # Convert relative link to absolute path
                current_dir = os.path.dirname(os.path.relpath(md_file, base_path))
                if current_dir and current_dir != '.':
                    target_path = os.path.normpath(os.path.join(current_dir, link))
                else:
                    target_path = link
                
                # Check if target exists
                if target_path not in all_md_files:
                    missing_targets.add(target_path)
        except Exception as e:
            print(f"Error checking links in {md_file}: {e}")
    
    # Create index pages for missing targets
    for target in missing_targets:
        target_full_path = os.path.join(base_path, target)
        target_dir = os.path.dirname(target_full_path)
        
        # Check if there's a corresponding directory with content
        target_name = os.path.splitext(os.path.basename(target))[0]
        content_dir = os.path.join(os.path.dirname(target_full_path), target_name)
        
        if os.path.isdir(content_dir):
            # Generate index page
            print(f"Creating index page: {target}")
            
            # Find all markdown files in the directory
            content_files = []
            for md_file in glob.glob(os.path.join(content_dir, "**/*.md"), recursive=True):
                rel_path = os.path.relpath(md_file, content_dir)
                title = os.path.splitext(os.path.basename(md_file))[0].replace('-', ' ').title()
                content_files.append((rel_path, title))
            
            content_files.sort()
            
            # Create index content
            index_content = f"# {target_name.replace('-', ' ').title()}\n\n"
            index_content += f"This section contains the following topics:\n\n"
            
            for file_path, title in content_files:
                index_content += f"- [{title}](./{target_name}/{file_path})\n"
            
            # Write index file
            os.makedirs(os.path.dirname(target_full_path), exist_ok=True)
            with open(target_full_path, 'w', encoding='utf-8') as f:
                f.write(index_content)

# Start downloading
download_and_parse("https://docs.docker.com/extensions/")

# After all files are downloaded, create missing index pages
script_dir = os.path.dirname(os.path.abspath(__file__))
base_dir = os.path.dirname(script_dir)
docker_extensions_path = os.path.join(base_dir, "docker-extensions")
create_missing_index_pages(docker_extensions_path)