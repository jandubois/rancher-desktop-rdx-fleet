# Card Types Reference

This document describes the available card types for customizing your Fleet extension UI. Cards are configured in the `manifest.yaml` file and displayed in the extension's main content area.

## Overview

Cards provide modular UI components that can be:
- Reordered via drag-and-drop (in edit mode)
- Shown or hidden individually
- Configured with type-specific settings

## Common Card Properties

All card types share these common properties:

```yaml
cards:
  - id: unique-card-id        # Required: Unique identifier for the card
    type: card-type           # Required: One of the types listed below
    title: "Card Title"       # Optional: Display title shown above card content
    visible: true             # Optional: Whether card is visible (default: true)
    enabled: true             # Optional: Whether card is interactive (default: true)
    settings:                 # Optional: Type-specific configuration
      # ... settings vary by card type
```

> **Note**: In edit mode, card titles can be edited inline by clicking on the title text. For dynamic cards like Fleet Status and GitRepo cards, the title defaults to a sensible value (e.g., the repository name) but can be customized.

---

## Markdown Card

Display rich text content with Markdown formatting. Useful for instructions, documentation, or announcements.

**Type:** `markdown`

### Use Cases
- Welcome messages or getting started guides
- Important notices or changelog information
- Links to external documentation
- Custom formatted content with headers, lists, and code blocks

### Configuration

```yaml
cards:
  - id: welcome-message
    type: markdown
    title: "Welcome"           # Optional: heading above content
    settings:
      # The markdown content to display
      # Supports full GitHub-flavored Markdown including:
      # - Headers, bold, italic, strikethrough
      # - Links and images
      # - Code blocks and inline code
      # - Bullet and numbered lists
      # - Blockquotes
      # - HTML (rendered safely)
      content: |
        ## Getting Started

        Welcome to **Fleet GitOps**! Follow these steps:

        1. Configure your Git repository below
        2. Select the paths to deploy
        3. Monitor deployment status

        For more information, see the [Fleet documentation](https://fleet.rancher.io/).
```

---

## HTML Card

Display raw HTML content with full JavaScript support. Unlike Markdown cards, HTML cards allow `<script>` elements to execute, enabling interactive widgets like stock tickers and weather displays.

**Type:** `html`

### Use Cases
- Stock tickers and financial charts
- Weather widgets
- Interactive visualizations with Chart.js or similar libraries
- Third-party embeddable content (via fetch+eval pattern)
- Custom interactive components

### Configuration

```yaml
cards:
  - id: stock-widget
    type: html
    title: "Stock Ticker"      # Optional: heading above content
    settings:
      # Raw HTML content - scripts will execute
      content: |
        <canvas id="chart" width="400" height="200"></canvas>
        <script>
          // JavaScript code runs with full network access
          fetch('https://api.example.com/data')
            .then(r => r.json())
            .then(data => {
              // Render your widget
            });
        </script>
```

### Security Notes
- HTML cards intentionally allow arbitrary JavaScript execution
- Content is provided by the extension author (manifest) or user (edit mode)
- Scripts have the same origin as the extension and can access localStorage

### Limitations (Rancher Desktop CSP)
Due to Content Security Policy restrictions:

- **External `<script src="...">` tags don't work** - Use fetch+eval pattern instead:
  ```html
  <script>
    fetch('https://cdn.example.com/library.js')
      .then(r => r.text())
      .then(code => eval(code));
  </script>
  ```
- **External iframes may not work** - Some sites block iframe embedding via X-Frame-Options

### Example: Stock Chart with Chart.js

See `examples/html-card-snippets/stock-chart.html` for a complete working example that:
- Fetches stock data from Yahoo Finance
- Renders an interactive chart using Chart.js
- Supports configurable time periods and log/linear scale

---

## Image Card

Display a static image from a URL. Useful for logos, diagrams, or visual content.

**Type:** `image`

### Use Cases
- Company or project logos
- Architecture diagrams
- Visual instructions or screenshots
- Banner images

### Configuration

```yaml
cards:
  - id: company-logo
    type: image
    title: "About Us"          # Optional: heading above image
    settings:
      # URL to the image file
      # Supports: PNG, JPG, GIF, SVG, WebP
      # Can be absolute URL or relative path
      src: "https://example.com/logo.png"

      # Alt text for accessibility and when image fails to load
      # Recommended for all images
      alt: "Company Logo"
```

### Notes
- Images are automatically scaled to fit the card width (max 400px height)
- If the image URL is invalid or unreachable, the image will not display
- In edit mode, you can preview the image as you configure it

---

## Video Card

Embed videos from YouTube, Vimeo, or direct video URLs. Useful for tutorials, demos, or presentations.

**Type:** `video`

### Use Cases
- Product demo videos
- Tutorial or how-to content
- Recorded presentations
- Training materials

### Configuration

```yaml
cards:
  - id: demo-video
    type: video
    title: "Quick Demo"        # Optional: heading above video
    settings:
      # Video source URL
      # Supported formats:
      # - YouTube: https://youtube.com/watch?v=VIDEO_ID
      # - YouTube: https://youtu.be/VIDEO_ID
      # - Vimeo: https://vimeo.com/VIDEO_ID
      # - Direct: https://example.com/video.mp4
      # - Direct: https://example.com/video.webm
      src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

      # Title for accessibility (screen readers)
      # Optional but recommended
      title: "Fleet GitOps Demo Video"
```

### Notes
- YouTube and Vimeo URLs are automatically converted to embed format
- Embedded videos display in 16:9 aspect ratio
- Direct video URLs use the browser's native video player with controls
- Supported direct video formats: MP4, WebM, Ogg

---

## Link Card

Display a collection of clickable links as buttons or a list. Useful for quick access to external resources.

**Type:** `link`

### Use Cases
- Quick links to documentation or dashboards
- External tool shortcuts
- Related resource navigation
- Action buttons for common tasks

### Configuration

```yaml
cards:
  - id: quick-links
    type: link
    title: "Resources"         # Optional: heading above links
    settings:
      # Display style: 'buttons' or 'list'
      # - buttons: Horizontal row of button-styled links
      # - list: Vertical list with link icons
      variant: buttons         # Optional: default is 'buttons'

      # Array of link items
      links:
        - label: "Documentation"           # Required: button/link text
          url: "https://fleet.rancher.io"  # Required: destination URL

        - label: "GitHub Repo"
          url: "https://github.com/rancher/fleet"

        - label: "Support"
          url: "https://slack.rancher.io"
```

### Variant Examples

**Buttons style** (`variant: buttons`):
```yaml
settings:
  variant: buttons
  links:
    - label: "Docs"
      url: "https://docs.example.com"
    - label: "Support"
      url: "https://support.example.com"
```
Links appear as horizontal buttons that wrap to new lines as needed.

**List style** (`variant: list`):
```yaml
settings:
  variant: list
  links:
    - label: "Fleet Documentation"
      url: "https://fleet.rancher.io"
    - label: "Rancher Community Slack"
      url: "https://slack.rancher.io"
    - label: "GitHub Issues"
      url: "https://github.com/rancher/fleet/issues"
```
Links appear as a vertical list with icons, suitable for longer labels.

### Notes
- All links open in a new browser tab
- Empty labels or URLs are filtered out and won't display
- In edit mode, you can add, remove, and reorder links

---

## Divider Card

Display a visual separator between cards. Useful for organizing content into sections.

**Type:** `divider`

### Use Cases
- Separating card groups by topic
- Creating visual sections
- Adding section headers with horizontal rules

### Configuration

```yaml
cards:
  - id: section-divider
    type: divider
    # Note: title property is ignored for dividers
    # Use the label setting instead for section titles
    settings:
      # Optional text label displayed in the center of the divider
      # Leave empty for a simple horizontal line
      label: "Configuration"

      # Line style: 'solid', 'dashed', or 'dotted'
      # Default is 'solid'
      style: solid
```

### Style Examples

**Simple divider** (no label):
```yaml
cards:
  - id: divider-1
    type: divider
    settings: {}
```

**Labeled section divider**:
```yaml
cards:
  - id: config-section
    type: divider
    settings:
      label: "Repository Configuration"
      style: solid
```

**Dashed divider**:
```yaml
cards:
  - id: divider-dashed
    type: divider
    settings:
      label: "Optional Settings"
      style: dashed
```

**Dotted divider**:
```yaml
cards:
  - id: divider-dotted
    type: divider
    settings:
      style: dotted
```

---

## Git Repository Card

Configure and manage Fleet GitRepo resources. This is the primary card type for GitOps workflows.

**Type:** `gitrepo`

### Use Cases
- Connecting to Git repositories containing Kubernetes manifests
- Selecting which paths/directories to deploy
- Managing Fleet GitRepo resources

### Configuration

```yaml
cards:
  - id: my-gitrepo
    type: gitrepo
    title: "Application Repository"   # Optional: heading above the card
    settings:
      # Whether users can duplicate this card to add more repos
      duplicatable: true

      # Repository URL field settings
      repo_url:
        editable: true              # Can user change the URL?
        default: "https://github.com/rancher/fleet-examples"
        locked: false               # Prevent any modification

      # Branch field settings
      branch:
        editable: true
        default: "main"

      # Paths field settings
      paths:
        editable: true
        default:                    # Pre-selected paths
          - "simple"
          - "helm"
        allowed:                    # Restrict to these paths only
          - "simple"
          - "helm"
          - "kustomize"

      # Maximum paths visible before scrolling (default: 6)
      max_visible_paths: 6
```

### Field Settings

Each field (`repo_url`, `branch`, `paths`) can have these settings:

| Setting | Type | Description |
|---------|------|-------------|
| `editable` | boolean | Whether the field can be modified by users |
| `default` | string/array | Default value(s) for the field |
| `locked` | boolean | Completely prevent modification (overrides editable) |
| `allowed` | array | Whitelist of allowed values (for paths) |

---

## Authentication Cards

**Note:** Authentication cards require additional backend integration and are not yet fully implemented.

### GitHub Authentication (`auth-github`)

For repositories requiring GitHub authentication.

```yaml
cards:
  - id: github-auth
    type: auth-github
    title: "GitHub Credentials"
    settings:
      required: false          # Is authentication mandatory?
      show_status: true        # Show connection status indicator
```

### Git Credentials (`auth-git`)

For generic Git authentication (username/password or SSH).

```yaml
cards:
  - id: git-auth
    type: auth-git
    title: "Git Credentials"
    settings:
      required: false
      show_status: true
```

### AppCo Authentication (`auth-appco`)

For Rancher Application Collection integration.

```yaml
cards:
  - id: appco-auth
    type: auth-appco
    title: "Application Collection"
    settings:
      required: false
      show_status: true
```

---

## Branding and Color Palette

Customize the extension's appearance using the `branding` section of the manifest.

### Color Palette

The `branding.palette` property allows you to customize UI colors:

```yaml
branding:
  palette:
    header:
      background: "#2e7d32"    # Header background color
      text: "#ffffff"          # Header text color
    body:
      background: "#f5f5f5"    # Page background color
    card:
      border: "#4caf50"        # Card border color
      title: "#1b5e20"         # Card title/text color
```

### Palette Properties

| Property | Description | Default |
|----------|-------------|---------|
| `header.background` | Header bar background color | `#1976d2` (MUI primary blue) |
| `header.text` | Header text and icon color | `#ffffff` (white) |
| `body.background` | Main content area background | `#fafafa` (light gray) |
| `card.border` | Card border color | `#e0e0e0` (gray) |
| `card.title` | Card title/text color | `inherit` |

All colors are optional. Unspecified colors fall back to their defaults.

### Example: Dark Header Theme

```yaml
branding:
  palette:
    header:
      background: "#1a1a1a"
      text: "#ffffff"
    body:
      background: "#f0f0f0"
```

### Example: Brand Colors

```yaml
branding:
  palette:
    header:
      background: "#00695c"    # Teal header
      text: "#ffffff"
    card:
      border: "#26a69a"        # Matching teal borders
```

---

## Complete Manifest Example

Here's a complete example showing multiple card types with custom branding:

```yaml
version: "1.0"

app:
  name: "Fleet GitOps"
  description: "Kubernetes GitOps with Fleet"

branding:
  palette:
    header:
      background: "#2e7d32"    # Custom green header
      text: "#ffffff"
    body:
      background: "#fafafa"

layout:
  show_fleet_status: true    # Show Fleet installation status
  show_activity_log: true    # Show activity/event log
  edit_mode: true            # Allow UI customization

cards:
  # Welcome message
  - id: welcome
    type: markdown
    settings:
      content: |
        ## Welcome to Fleet GitOps

        Configure your repositories below to start deploying.

  # Section divider
  - id: repos-section
    type: divider
    settings:
      label: "Repositories"
      style: solid

  # Main Git repository
  - id: main-repo
    type: gitrepo
    title: "Application Repository"
    settings:
      duplicatable: true
      repo_url:
        editable: true
      paths:
        editable: true

  # Quick links
  - id: resources
    type: link
    title: "Helpful Resources"
    settings:
      variant: buttons
      links:
        - label: "Fleet Docs"
          url: "https://fleet.rancher.io"
        - label: "Examples"
          url: "https://github.com/rancher/fleet-examples"

  # Tutorial video
  - id: tutorial
    type: video
    title: "Getting Started Video"
    settings:
      src: "https://www.youtube.com/watch?v=example"
      title: "Fleet GitOps Tutorial"
```

---

## Tips

1. **Card IDs must be unique** within your manifest
2. **Use descriptive IDs** like `welcome-message` rather than `card1`
3. **Titles are optional** - omit them for cleaner layouts when not needed
4. **Test in edit mode** - use the UI's edit mode to preview and adjust cards
5. **Dividers help organization** - use them to create logical sections
