from PIL import Image, ImageOps
import argparse
import os

def resize_png(input_path, output_suffix=None, width=None, height=None, mode='scale', 
               background=(255, 255, 255, 0), keep_aspect=True, quality=95):
    """
    调整PNG图片大小并保留原图
    
    参数:
        input_path (str): 输入文件路径
        output_suffix (str): 输出文件后缀(可选)
        width (int): 目标宽度(像素)
        height (int): 目标高度(像素)
        mode (str): 调整模式:
            'scale' - 缩放(默认)
            'crop' - 裁剪
            'pad' - 填充
            'stretch' - 拉伸(忽略比例)
        background (tuple): 填充背景色(R,G,B,A)
        keep_aspect (bool): 是否保持宽高比
        quality (int): 输出质量(1-100)
    """
    try:
        # 打开原始图像
        img = Image.open(input_path)
        original_width, original_height = img.size
        
        # 自动生成输出路径
        dirname, basename = os.path.split(input_path)
        name, ext = os.path.splitext(basename)
        
        # 生成尺寸标识
        size_tag = ""
        if width and height:
            size_tag = f"_{width}x{height}"
        elif width:
            size_tag = f"_w{width}"
        elif height:
            size_tag = f"_h{height}"
            
        # 添加模式标识
        if mode != 'scale':
            size_tag += f"_{mode}"
            
        # 添加自定义后缀
        if output_suffix:
            size_tag += f"_{output_suffix}"
            
        output_path = os.path.join(dirname, f"{name}{size_tag}{ext}")
        
        # 避免覆盖原文件
        counter = 1
        while os.path.exists(output_path):
            output_path = os.path.join(dirname, f"{name}{size_tag}_{counter}{ext}")
            counter += 1
        
        # 计算目标尺寸
        if width is None and height is None:
            raise ValueError("必须指定width或height至少一个参数")
        
        if keep_aspect and width and height and mode != 'stretch':
            ratio = min(width/original_width, height/original_height)
            target_width = int(original_width * ratio)
            target_height = int(original_height * ratio)
        else:
            target_width = width if width else original_width
            target_height = height if height else original_height
        
        # 根据模式处理图像
        if mode == 'scale':
            resized_img = img.resize((target_width, target_height), Image.LANCZOS)
        elif mode == 'crop':
            resized_img = ImageOps.fit(img, (target_width, target_height), 
                                    method=Image.LANCZOS, 
                                    bleed=0.0, 
                                    centering=(0.5, 0.5))
        elif mode == 'pad':
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            ratio = min(target_width/original_width, target_height/original_height)
            new_width = int(original_width * ratio)
            new_height = int(original_height * ratio)
            
            scaled_img = img.resize((new_width, new_height), Image.LANCZOS)
            new_img = Image.new('RGBA', (target_width, target_height), background)
            offset = ((target_width - new_width) // 2, (target_height - new_height) // 2)
            new_img.paste(scaled_img, offset)
            resized_img = new_img
        elif mode == 'stretch':
            resized_img = img.resize((target_width, target_height), Image.LANCZOS)
        else:
            raise ValueError(f"未知的模式: {mode}")
        
        # 保存结果
        resized_img.save(output_path, 'PNG', quality=quality)
        print(f"原图保留: {input_path}")
        print(f"新图生成: {output_path}")
        print(f"原始尺寸: {original_width}x{original_height}")
        print(f"新尺寸: {resized_img.size[0]}x{resized_img.size[1]}")
        
    except Exception as e:
        print(f"处理失败: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='调整PNG图片大小(保留原图)')
    parser.add_argument('input', help='输入PNG文件路径')
    parser.add_argument('-s', '--suffix', help='输出文件自定义后缀(可选)')
    parser.add_argument('-W', '--width', type=int, help='目标宽度(像素)')
    parser.add_argument('-H', '--height', type=int, help='目标高度(像素)')
    parser.add_argument('-m', '--mode', 
                       choices=['scale', 'crop', 'pad', 'stretch'], 
                       default='scale',
                       help='调整模式: scale(缩放,默认), crop(裁剪), pad(填充), stretch(拉伸)')
    parser.add_argument('-bg', '--background', 
                       default='255,255,255,0',
                       help='填充背景色(R,G,B,A)，默认透明(255,255,255,0)')
    parser.add_argument('-q', '--quality', 
                       type=int, default=95,
                       help='输出质量(1-100)，默认95')
    
    args = parser.parse_args()
    
    try:
        bg_values = [int(x) for x in args.background.split(',')]
        if len(bg_values) == 3:
            bg_values.append(255)
        background = tuple(bg_values[:4])
    except:
        print("背景色格式错误，使用默认透明背景")
        background = (255, 255, 255, 0)
    
    resize_png(
        input_path=args.input,
        output_suffix=args.suffix,
        width=args.width,
        height=args.height,
        mode=args.mode,
        background=background,
        quality=args.quality
    )


# 按比例缩放(保持宽高比):
# python resize_png.py input.png -W 300  # 宽度设为300，高度自动计算
# python resize_png.py input.png -H 200  # 高度设为200，宽度自动计算
# 指定宽高(不保持比例):
# python resize_png.py input.png -W 300 -H 200 -m stretch
# 裁剪到指定尺寸:
# python resize_png.py input.png -W 300 -H 200 -m crop
# 填充到指定尺寸(带透明背景):
# python resize_png.py input.png -W 500 -H 500 -m pad -bg "0,0,0,0"