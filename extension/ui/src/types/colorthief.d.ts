/**
 * Type definitions for colorthief
 * @see https://lokeshdhakar.com/projects/color-thief/
 */
declare module 'colorthief' {
  /**
   * RGB color tuple [red, green, blue] with values 0-255
   */
  type RGBColor = [number, number, number];

  /**
   * ColorThief - Grab the dominant color or color palette from an image
   */
  class ColorThief {
    /**
     * Get the dominant color from an image
     * @param img - HTML image element or canvas
     * @param quality - Quality setting (1-10, default 10). 1 is fastest, 10 is most accurate.
     * @returns RGB color array [r, g, b]
     */
    getColor(img: HTMLImageElement | HTMLCanvasElement, quality?: number): RGBColor | null;

    /**
     * Get a color palette from an image
     * @param img - HTML image element or canvas
     * @param colorCount - Number of colors to extract (2-256, default 10)
     * @param quality - Quality setting (1-10, default 10). 1 is fastest, 10 is most accurate.
     * @returns Array of RGB color arrays
     */
    getPalette(
      img: HTMLImageElement | HTMLCanvasElement,
      colorCount?: number,
      quality?: number
    ): RGBColor[] | null;
  }

  export default ColorThief;
}
