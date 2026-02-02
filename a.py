import cv2
import imageio
import numpy as np
import glob
import random
from tqdm import trange

def create_header():
    paths = [
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/SM2',
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/SMu1',
        # '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/ABF12',
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/genhoi_controller1',
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/GSF13',
    ]

    all_image_paths = []
    for p in paths:
        image_paths = sorted(glob.glob(f'{p}/*.png'))
        random.shuffle(image_paths)
        all_image_paths.append(image_paths)
        
    print(f"Found {len(all_image_paths)} images")

    # 参数设置
    output_width = 1600
    output_height = 800
    num_columns = 8
    column_width = output_width // num_columns  # 每列宽度 204.8，取整为 204

    # 创建空白画布
    canvas = np.zeros((output_height, output_width, 3), dtype=np.uint8)

    for col in trange(num_columns):
        # 当前列的起始x坐标
        x_start = col * column_width
        x_end = (col + 1) * column_width if col < num_columns - 1 else output_width
        
        shuffled_paths = all_image_paths[col % len(all_image_paths)]
        
        # 当前列的图片索引范围
        # 纵向拼接当前列的图片
        y_offset = 0
        images = []
        for img_path in shuffled_paths:
            # 读取图片
            img = cv2.imread(img_path)
            if img is None:
                continue
            
            # 调整图片宽度以适应列宽
            h, w = img.shape[:2]
            new_width = x_end - x_start
            new_height = int(h * new_width / w)
            img_resized = cv2.resize(img, (new_width, new_height))
            
            images.append(img_resized)
        
        image_col = np.vstack(images)
        col_start_y = np.random.randint(0, image_col.shape[0]-output_height)
        col_end_y = col_start_y + output_height
        if col_end_y <= image_col.shape[0]:
            canvas[:, x_start:x_end] = image_col[col_start_y:col_end_y, :]

    # 保存结果
    output_path = f'static/img/header_test.png'
    cv2.imwrite(output_path, canvas)
    print(f"Collage saved to {output_path}")

def create_header_row():
    paths = [
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/SM2',
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/SMu1',
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/ABF12',
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/genhoi_controller1',
        '/mnt/nas/share/home/ybh/codes/HOI/rendered_videos/GSF13',
    ]

    all_image_paths = []
    for p in paths:
        image_paths = sorted(glob.glob(f'{p}/*.png'))
        # random.shuffle(image_paths)
        all_image_paths.append(image_paths)
        
    print(f"Found {len(all_image_paths)} video folders")

    # 参数设置
    output_width = 1600
    output_height = 500
    num_rows = 5  # 5个视频，5行
    row_height = output_height // num_rows  # 每行高度

    # 创建空白画布
    canvas = np.zeros((output_height, output_width, 3), dtype=np.uint8)

    for row in trange(num_rows):
        # 当前行的起始y坐标
        y_start = row * row_height
        y_end = (row + 1) * row_height if row < num_rows - 1 else output_height
        
        # 当前行对应的图片列表
        shuffled_paths = all_image_paths[row % len(all_image_paths)]
        random_start = random.randint(0, max(0, len(shuffled_paths) - 100))
        shuffled_paths = shuffled_paths[random_start::3]
        shuffled_paths = reversed(shuffled_paths)
        
        # 横向拼接当前行的图片
        x_offset = 0
        images = []
        for img_path in shuffled_paths:
            # 读取图片
            img = cv2.imread(img_path)
            if img is None:
                continue
            
            # 调整图片高度以适应行高
            h, w = img.shape[:2]
            new_height = y_end - y_start
            new_width = int(w * new_height / h)
            img_resized = cv2.resize(img, (new_width, new_height))
            
            images.append(img_resized)
        
        # 横向堆叠所有图片
        image_row = np.hstack(images)
        
        # 随机选择起始位置，确保能填满整行宽度
        if image_row.shape[1] >= output_width:
            row_start_x = np.random.randint(0, image_row.shape[1] - output_width)
            row_end_x = row_start_x + output_width
            canvas[y_start:y_end, :] = image_row[:, row_start_x:row_end_x]
        else:
            # 如果图片总宽度不够，重复拼接
            while image_row.shape[1] < output_width:
                image_row = np.hstack([image_row, image_row])
            canvas[y_start:y_end, :] = image_row[:, :output_width]

    # 保存结果
    output_path = f'static/img/header_test.png'
    cv2.imwrite(output_path, canvas)
    print(f"Row-based collage saved to {output_path}")

def create_scrolling_gif():
    # 读取图片
    img = cv2.imread('static/img/header_test.png')
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    h, w = img.shape[:2]

    # 生成滚动帧
    frames = []
    scroll_distance = w  # 完整滚动一圈
    num_frames = 24 * 8  # 帧数

    for i in trange(num_frames):
        # 计算偏移量（反向滚动）
        offset = int(((num_frames - i) / num_frames) * scroll_distance)  # 改这里：num_frames - i
        
        # 创建首尾相连的帧
        frame = np.hstack([img[:, offset:], img[:, :offset]])
        frames.append(frame)

    # 保存为GIF
    imageio.mimsave('static/img/header_scroll.gif', frames, duration=1 / 12, loop=0)
    print(f"GIF saved to static/img/header_scroll.gif")

# create_header()
# create_header_row()
create_scrolling_gif()