# HTML Card Snippets

Example HTML snippets for use with the HTML card type in Fleet GitOps extensions.

## Available Snippets

### stock-chart.html

A stock chart widget that displays real-time stock data from Yahoo Finance.

**Features:**
- Configurable time periods (1 day to max history)
- Toggle between linear and logarithmic scale
- Current price display
- Uses Chart.js for rendering

**Usage:**
1. Create an HTML card in the extension
2. Copy the contents of `stock-chart.html` into the card
3. Modify the `SYMBOL` variable to track a different stock

## Notes on HTML Card Limitations

Due to Content Security Policy (CSP) restrictions in Rancher Desktop extensions:

- **External `<script src="...">` tags don't work** - Scripts must be loaded via fetch+eval
- **External iframes may not work** - Some widgets (like TradingView) create iframes that get blocked
- **Inline scripts work** - JavaScript in `<script>` tags executes normally
- **Fetch requests work** - You can fetch data from external APIs

### Workaround Pattern

To load external JavaScript libraries, use this pattern:

```html
<script>
  fetch('https://cdn.example.com/library.js')
    .then(r => r.text())
    .then(code => {
      eval(code);
      // Library is now available
    });
</script>
```
