from PIL import Image
import argparse
import os

def png_to_ico(input_path, output_path=None, sizes=None):
    """Convert PNG to ICO with better compatibility."""
    if sizes is None:
        sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256), (512, 512)]
    
    if output_path is None:
        base_name = os.path.splitext(input_path)[0]
        output_path = f"{base_name}.ico"

    try:
        # Open image and ensure RGBA mode
        img = Image.open(input_path)
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Create square versions for each size
        ico_images = []
        for size in sizes:
            resized_img = img.resize(size, Image.LANCZOS)
            ico_images.append(resized_img)
        
        # Save all sizes to ICO
        ico_images[0].save(
            output_path,
            format="ICO",
            append_images=ico_images[1:],
            bitmap_format="bmp",  # Improve compatibility
            quality=100
        )
        
        print(f"Success: {input_path} -> {output_path}")
        print(f"Sizes: {', '.join([f'{w}x{h}' for w, h in sizes])}")
    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Convert PNG to ICO (fixed)')
    parser.add_argument('input', help='Input PNG file path')
    parser.add_argument('-o', '--output', help='Output ICO file path (optional)')
    parser.add_argument('-s', '--sizes', help='Custom sizes, e.g., "16,32,64"', default="16,32,48,64,128,256")
    
    args = parser.parse_args()
    sizes = [(int(s), int(s)) for s in args.sizes.split(',')]
    png_to_ico(args.input, args.output, sizes)


# python3 png_to_ico.py jlcAssistant512.png -s "512" -o jlcAssistant512.ico 