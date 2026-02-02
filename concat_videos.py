#!/usr/bin/env python3
"""
视频横向拼接脚本
根据文件夹类型和命名规则，按指定顺序拼接视频
"""

import os
import subprocess
import json
import re
from pathlib import Path


def get_video_info(video_path):
    """获取视频信息"""
    cmd = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    info = json.loads(result.stdout)

    for stream in info['streams']:
        if stream['codec_type'] == 'video':
            return {
                'width': int(stream['width']),
                'height': int(stream['height']),
                'duration': float(stream.get('duration', 0))
            }
    return None


def classify_folder_type(folder_name):
    """判断文件夹类型"""
    if '_rotate' in folder_name:
        return 'rotate'
    elif '_retarget' in folder_name:
        return 'retarget'
    else:
        return 'comparison'


def sort_comparison_videos(video_files, folder_name=None):
    """
    常规对比类排序：input/原始 → GT → Ours → HOLD → MagicHOI
    对于有trimmed版本的ours视频，只使用trimmed版本
    对于dexycb，优先使用cropped版本
    """
    order_map = {}
    filtered_videos = []

    # 检查是否存在 ours_trimmed 视频
    has_ours_trimmed = any('ours_' in os.path.basename(v) and 'trimmed' in os.path.basename(v) for v in video_files)

    # 检查是否是dexycb文件夹
    is_dexycb = folder_name and folder_name.startswith('dexycb')

    for video in video_files:
        basename = os.path.basename(video).lower()

        # 如果是dexycb，优先使用cropped版本
        if is_dexycb:
            if 'cropped' not in basename and not 'placeholder' in basename:
                # 检查是否存在cropped版本
                cropped_path = video.replace('.mp4', '_cropped.mp4')
                if os.path.exists(cropped_path):
                    continue  # 跳过原始版本

        # 如果存在trimmed版本的ours，跳过原始的ours
        if 'ours_' in basename and 'trimmed' not in basename and has_ours_trimmed:
            continue

        # 判断视频类型并分配优先级
        if 'input_' in basename or 'input_placeholder' in basename or (basename.endswith('_cut.mp4') and not any(prefix in basename for prefix in ['gt_', 'hold_', 'magichoi_', 'ours_'])):
            order_map[video] = 0  # input/原始
            filtered_videos.append(video)
        elif 'gt_' in basename or 'gt_placeholder' in basename:
            order_map[video] = 1  # GT
            filtered_videos.append(video)
        elif 'ours_' in basename or 'ours_placeholder' in basename:
            order_map[video] = 2  # Ours (包括trimmed版本)
            filtered_videos.append(video)
        elif 'hold_' in basename or 'hold_placeholder' in basename:
            order_map[video] = 3  # HOLD
            filtered_videos.append(video)
        elif 'magichoi_' in basename or 'magichoi_placeholder' in basename:
            order_map[video] = 4  # MagicHOI
            filtered_videos.append(video)
        else:
            order_map[video] = 99  # 其他视频放最后
            filtered_videos.append(video)

    return sorted(filtered_videos, key=lambda x: order_map.get(x, 99))


def sort_rotate_videos(video_files):
    """
    Rotate类排序：original → overlayed_objtexture → objtexture_rotateframe → rotateframe
    """
    order_map = {}

    for video in video_files:
        basename = os.path.basename(video).lower()

        if 'original' in basename:
            order_map[video] = 0
        elif 'overlayed_objtexture' in basename:
            order_map[video] = 1
        elif 'objtexture_rotateframe' in basename:
            order_map[video] = 2
        elif 'rotateframe' in basename:
            order_map[video] = 3
        else:
            order_map[video] = 99

    return sorted(video_files, key=lambda x: order_map.get(x, 99))


def sort_retarget_videos(video_files):
    """
    Retarget类排序：{object}_cut_cut_trimmed.mp4 → {timestamp}.mp4
    只使用 trimmed 版本，排除原始的 cut_cut 视频
    """
    order_map = {}
    filtered_videos = []

    for video in video_files:
        basename = os.path.basename(video)

        # 只保留 trimmed 版本和时间戳视频
        if 'trimmed' in basename and 'cut_cut' in basename:
            order_map[video] = 0
            filtered_videos.append(video)
        elif re.match(r'\d{8}-\d{6}\.mp4', basename):  # 时间戳格式
            order_map[video] = 1
            filtered_videos.append(video)
        # 跳过原始的 cut_cut 视频（没有trimmed后缀的）

    return sorted(filtered_videos, key=lambda x: order_map.get(x, 99))


def trim_video(input_path, output_path, start_time=None, duration=None):
    """
    裁剪视频
    :param input_path: 输入视频路径
    :param output_path: 输出视频路径
    :param start_time: 开始时间（秒），如果为None则从头开始
    :param duration: 持续时间（秒），如果为None则到结尾
    """
    cmd = ['ffmpeg', '-y', '-i', input_path]

    if start_time is not None:
        cmd.extend(['-ss', str(start_time)])

    if duration is not None:
        cmd.extend(['-t', str(duration)])

    cmd.extend([
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'copy',
        output_path
    ])

    print(f"  裁剪视频: {os.path.basename(input_path)}")
    if start_time is not None:
        print(f"    从 {start_time:.2f}秒开始")
    if duration is not None:
        print(f"    持续 {duration:.2f}秒")

    result = subprocess.run(cmd, capture_output=True)
    return result.returncode == 0


def preprocess_retarget_folder(folder_path, folder_name):
    """
    预处理retarget文件夹，对特定视频进行裁剪
    """
    print(f"\n预处理 {folder_name} 文件夹...")

    if folder_name == 'ABF12_retarget':
        # ABF12: 裁剪 ABF12_cut_cut_cut.mp4 的前面部分
        cut_video = os.path.join(folder_path, 'ABF12_cut_cut_cut.mp4')
        timestamp_video = os.path.join(folder_path, '20260122-234521.mp4')

        if os.path.exists(cut_video) and os.path.exists(timestamp_video):
            # 获取目标时长
            target_info = get_video_info(timestamp_video)
            target_duration = target_info['duration']

            # 裁剪后的文件名
            trimmed_video = os.path.join(folder_path, 'ABF12_cut_cut_cut_trimmed.mp4')

            # 裁剪视频（去掉前面部分）
            source_info = get_video_info(cut_video)
            source_duration = source_info['duration']
            start_time = source_duration - target_duration

            if trim_video(cut_video, trimmed_video, start_time=start_time):
                print(f"  ✓ 裁剪成功: {os.path.basename(trimmed_video)}")
            else:
                print(f"  ✗ 裁剪失败")

    elif folder_name == 'SM2_retarget':
        # SM2: 裁剪 SM2_cut_cut.mp4 的后面部分
        cut_video = os.path.join(folder_path, 'SM2_cut_cut.mp4')
        timestamp_video = os.path.join(folder_path, '20260123-005504.mp4')

        if os.path.exists(cut_video) and os.path.exists(timestamp_video):
            # 获取目标时长
            target_info = get_video_info(timestamp_video)
            target_duration = target_info['duration']

            # 裁剪后的文件名
            trimmed_video = os.path.join(folder_path, 'SM2_cut_cut_trimmed.mp4')

            # 裁剪视频（保留前面部分）
            if trim_video(cut_video, trimmed_video, duration=target_duration):
                print(f"  ✓ 裁剪成功: {os.path.basename(trimmed_video)}")
            else:
                print(f"  ✗ 裁剪失败")


def detect_and_crop_black_borders(video_path, output_path):
    """
    检测并裁剪视频的黑色边框
    """
    # 使用cropdetect检测黑边，使用更长的时间和更低的阈值
    cmd = [
        'ffmpeg', '-i', video_path,
        '-vf', 'cropdetect=20:2:0',
        '-f', 'null', '-',
        '-t', '3'  # 检测3秒而不是1秒
    ]

    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    # 从输出中提取crop参数
    crop_params = None
    for line in result.stdout.split('\n'):
        if 'crop=' in line:
            # 提取最后一个crop参数
            parts = line.split('crop=')
            if len(parts) > 1:
                crop_params = parts[-1].split()[0]

    if crop_params:
        print(f"    检测到黑边，裁剪参数: {crop_params}")
        # 执行裁剪
        cmd = [
            'ffmpeg', '-y', '-i', video_path,
            '-vf', f'crop={crop_params}',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-c:a', 'copy',
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True)
        return result.returncode == 0, crop_params
    else:
        print(f"    未检测到黑边")
        return False, None


def create_black_placeholder(width, height, duration, output_path):
    """
    创建一个黑色占位视频
    """
    cmd = [
        'ffmpeg', '-y',
        '-f', 'lavfi',
        '-i', f'color=c=black:s={width}x{height}:d={duration}:r=12',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True)
    return result.returncode == 0


def preprocess_dexycb_folder(folder_path, folder_name):
    """
    预处理dexycb文件夹：去除黑边，创建缺失方法的占位视频
    """
    print(f"\n预处理 {folder_name} 文件夹...")

    # 查找所有视频
    videos = {}
    for file in os.listdir(folder_path):
        if file.endswith('.mp4'):
            full_path = os.path.join(folder_path, file)
            basename = os.path.basename(file).lower()

            if 'input_' in basename:
                videos['input'] = full_path
            elif 'gt_' in basename:
                videos['gt'] = full_path
            elif 'ours_' in basename:
                videos['ours'] = full_path
            elif 'hold_' in basename:
                videos['hold'] = full_path
            elif 'magichoi_' in basename:
                videos['magichoi'] = full_path

    # dexycb_07 特殊处理：三步骤裁剪流程
    if folder_name == 'dexycb_07':
        print(f"  dexycb_07: 三步骤裁剪流程")

        # 步骤1: 上下裁剪到高度 976
        target_height = 976
        print(f"  步骤1: 上下裁剪到高度 {target_height}")

        temp_videos = {}  # 存储第一步裁剪后的视频路径
        for method, video_path in videos.items():
            temp_path = video_path.replace('.mp4', '_temp976.mp4')
            temp_videos[method] = temp_path
            print(f"    处理 {method} 视频...")

            video_info = get_video_info(video_path)
            if video_info:
                video_height = video_info['height']
                video_width = video_info['width']

                if video_height > target_height:
                    # 计算上下裁剪的起始位置（居中裁剪）
                    y_offset = (video_height - target_height) // 2
                    crop_param = f"{video_width}:{target_height}:0:{y_offset}"

                    print(f"      上下裁剪: {video_height} -> {target_height}")
                    cmd = [
                        'ffmpeg', '-y', '-i', video_path,
                        '-vf', f'crop={crop_param}',
                        '-c:v', 'libx264',
                        '-preset', 'medium',
                        '-crf', '23',
                        '-c:a', 'copy',
                        temp_path
                    ]
                    result = subprocess.run(cmd, capture_output=True)
                    if result.returncode == 0:
                        print(f"      ✓ 上下裁剪成功")
                    else:
                        print(f"      ✗ 上下裁剪失败")
                else:
                    # 高度相同或更小，直接复制
                    print(f"      复制原视频（高度: {video_height}）")
                    import shutil
                    shutil.copy2(video_path, temp_path)

        # 步骤2: 自动检测并裁剪黑边
        print(f"\n  步骤2: 自动检测并裁剪黑边")
        temp2_videos = {}  # 存储第二步裁剪后的视频路径
        for method, temp_path in temp_videos.items():
            temp2_path = temp_path.replace('_temp976.mp4', '_temp_crop.mp4')
            temp2_videos[method] = temp2_path
            print(f"    处理 {method} 视频...")

            success, crop_params = detect_and_crop_black_borders(temp_path, temp2_path)
            if success:
                print(f"      ✓ 去黑边成功 (参数: {crop_params})")
            else:
                # 如果没有黑边，复制第一步的视频
                print(f"      未检测到黑边，使用第一步的视频")
                import shutil
                shutil.copy2(temp_path, temp2_path)

        # 步骤3: 以 input 视频的尺寸为基准，统一处理所有视频
        print(f"\n  步骤3: 以 input 视频的尺寸为基准统一处理")
        if 'input' in temp2_videos:
            input_info = get_video_info(temp2_videos['input'])
            if input_info:
                target_width = input_info['width']
                target_height_final = input_info['height']
                print(f"    参考尺寸 (input): {target_width}x{target_height_final}")

                for method, temp2_path in temp2_videos.items():
                    cropped_path = videos[method].replace('.mp4', '_cropped.mp4')
                    print(f"    处理 {method} 视频...")

                    video_info = get_video_info(temp2_path)
                    if video_info:
                        current_width = video_info['width']
                        current_height = video_info['height']

                        # 如果尺寸不一致，进行居中裁剪或填充
                        if current_width == target_width and current_height == target_height_final:
                            print(f"      尺寸一致，直接使用")
                            import shutil
                            shutil.copy2(temp2_path, cropped_path)
                        else:
                            # 如果当前视频更大，进行居中裁剪
                            if current_width >= target_width and current_height >= target_height_final:
                                x_offset = (current_width - target_width) // 2
                                y_offset = (current_height - target_height_final) // 2
                                crop_param = f"{target_width}:{target_height_final}:{x_offset}:{y_offset}"

                                print(f"      居中裁剪: {current_width}x{current_height} -> {target_width}x{target_height_final}")
                                cmd = [
                                    'ffmpeg', '-y', '-i', temp2_path,
                                    '-vf', f'crop={crop_param}',
                                    '-c:v', 'libx264',
                                    '-preset', 'medium',
                                    '-crf', '23',
                                    '-c:a', 'copy',
                                    cropped_path
                                ]
                                result = subprocess.run(cmd, capture_output=True)
                                if result.returncode == 0:
                                    print(f"      ✓ 统一尺寸成功")
                                else:
                                    print(f"      ✗ 统一尺寸失败")
                            else:
                                # 如果当前视频更小，直接使用（或可以选择填充黑边）
                                print(f"      视频较小 ({current_width}x{current_height})，直接使用")
                                import shutil
                                shutil.copy2(temp2_path, cropped_path)

                # 清理临时文件
                print(f"\n  清理临时文件...")
                for method in videos.keys():
                    temp_path = videos[method].replace('.mp4', '_temp976.mp4')
                    temp2_path = videos[method].replace('.mp4', '_temp_crop.mp4')
                    for path in [temp_path, temp2_path]:
                        if os.path.exists(path):
                            os.remove(path)
                            print(f"    删除: {os.path.basename(path)}")
            else:
                print(f"    ✗ 无法获取 input 视频信息")
        else:
            print(f"    ✗ 未找到 input 视频")
    else:
        # 其他 dexycb 文件夹：自动检测黑边
        for method, video_path in videos.items():
            cropped_path = video_path.replace('.mp4', '_cropped.mp4')
            print(f"  处理 {method} 视频...")
            success, crop_params = detect_and_crop_black_borders(video_path, cropped_path)
            if success:
                print(f"    ✓ 去黑边成功")
            else:
                # 如果没有黑边，复制原视频
                print(f"    复制原视频")
                import shutil
                shutil.copy2(video_path, cropped_path)

    # 获取gt视频信息（作为参考）
    if 'gt' in videos:
        gt_cropped = videos['gt'].replace('.mp4', '_cropped.mp4')
        gt_info = get_video_info(gt_cropped)

        if gt_info:
            # 检查缺失的方法并创建占位视频
            required_methods = ['input', 'gt', 'ours', 'hold', 'magichoi']
            for method in required_methods:
                if method not in videos:
                    print(f"  缺少 {method} 视频，创建黑色占位...")
                    placeholder_path = os.path.join(folder_path, f'{method}_placeholder_cropped.mp4')
                    if create_black_placeholder(gt_info['width'], gt_info['height'], gt_info['duration'], placeholder_path):
                        print(f"    ✓ 占位视频创建成功")
                    else:
                        print(f"    ✗ 占位视频创建失败")


def preprocess_comparison_folder(folder_path, folder_name):
    """
    预处理comparison文件夹，对特定视频进行裁剪
    """
    print(f"\n预处理 {folder_name} 文件夹...")

    if folder_name in ['SM4', 'GSF13']:
        # 查找 gt 和 ours 视频
        gt_video = None
        ours_video = None

        for file in os.listdir(folder_path):
            if file.startswith('gt_') and file.endswith('_cut.mp4'):
                gt_video = os.path.join(folder_path, file)
            elif file.startswith('ours_') and file.endswith('_cut.mp4'):
                ours_video = os.path.join(folder_path, file)

        if gt_video and ours_video and os.path.exists(gt_video) and os.path.exists(ours_video):
            # 获取gt的时长作为目标时长
            gt_info = get_video_info(gt_video)
            target_duration = gt_info['duration']

            # 裁剪后的文件名
            ours_basename = os.path.basename(ours_video)
            trimmed_video = os.path.join(folder_path, ours_basename.replace('.mp4', '_trimmed.mp4'))

            # 裁剪ours视频的后面部分
            if trim_video(ours_video, trimmed_video, duration=target_duration):
                print(f"  ✓ 裁剪成功: {os.path.basename(trimmed_video)}")
            else:
                print(f"  ✗ 裁剪失败")


def find_videos_in_folder(folder_path, folder_type, folder_name=None):
    """查找文件夹中的所有视频文件并按规则排序"""
    video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'}
    videos = []

    for file in os.listdir(folder_path):
        full_path = os.path.join(folder_path, file)
        if os.path.isfile(full_path) and Path(file).suffix.lower() in video_extensions:
            videos.append(full_path)

    # 根据文件夹类型应用不同的排序规则
    if folder_type == 'comparison':
        videos = sort_comparison_videos(videos, folder_name)
    elif folder_type == 'rotate':
        videos = sort_rotate_videos(videos)
    elif folder_type == 'retarget':
        videos = sort_retarget_videos(videos)

    return videos


def get_subfolders(root_dir):
    """获取所有子文件夹"""
    subfolders = []
    for item in os.listdir(root_dir):
        full_path = os.path.join(root_dir, item)
        if os.path.isdir(full_path):
            subfolders.append(full_path)
    return sorted(subfolders)


def create_hstack_video(video_files, output_file, folder_name, folder_type):
    """创建横向拼接的视频"""
    if not video_files:
        print(f"  {folder_name}: 没有找到视频文件")
        return False

    print(f"\n{'='*60}")
    print(f"处理文件夹: {folder_name} (类型: {folder_type})")
    print(f"找到 {len(video_files)} 个视频文件")
    print("\n排序后的视频列表:")
    for i, video in enumerate(video_files, 1):
        print(f"  {i}. {os.path.basename(video)}")

    # 获取第一个视频的信息作为目标尺寸
    first_video_info = get_video_info(video_files[0])
    if not first_video_info:
        print("  无法获取第一个视频的信息")
        return False

    target_height = first_video_info['height']
    target_width = first_video_info['width']

    print(f"\n目标尺寸: {target_width}x{target_height}")
    print("处理视频...")

    # 构建ffmpeg filter_complex
    filters = []
    inputs = []

    for i, video in enumerate(video_files):
        inputs.extend(['-i', video])

        # 获取当前视频的尺寸
        video_info = get_video_info(video)
        if not video_info:
            print(f"  警告: 无法获取视频 {os.path.basename(video)} 的信息")
            return False

        # 计算缩放后的宽度
        scaled_width = int(video_info['width'] * target_height / video_info['height'])

        # 缩放到目标高度，保持宽高比
        scale_filter = f"[{i}:v]scale=-1:{target_height}"

        # Retarget类不进行裁剪，只缩放
        if folder_type == 'retarget':
            filters.append(f"{scale_filter}[v{i}]")
        else:
            # 其他类型：如果缩放后的宽度小于目标宽度，只缩放不裁剪
            if scaled_width < target_width:
                print(f"  视频 {os.path.basename(video)}: 缩放后宽度 {scaled_width} < 目标宽度 {target_width}，跳过裁剪")
                filters.append(f"{scale_filter}[v{i}]")
            else:
                # 缩放后居中裁剪到目标宽度
                crop_filter = f"crop={target_width}:{target_height}"
                filters.append(f"{scale_filter},{crop_filter}[v{i}]")

    # 横向拼接所有视频
    hstack_inputs = ''.join(f"[v{i}]" for i in range(len(video_files)))
    hstack_filter = f"{hstack_inputs}hstack=inputs={len(video_files)}[outv]"

    filter_complex = ';'.join(filters) + ';' + hstack_filter

    # 构建完整的ffmpeg命令
    cmd = ['ffmpeg', '-y'] + inputs + [
        '-filter_complex', filter_complex,
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        output_file
    ]

    print(f"\n执行命令:")
    print(' '.join(cmd[:5]) + ' ... [多个输入] ...')
    print("\n开始处理...")

    # 执行ffmpeg命令
    result = subprocess.run(cmd, capture_output=True)

    if os.path.exists(output_file):
        print(f"\n✓ 成功! 输出文件: {output_file}")
        print(f"  文件大小: {os.path.getsize(output_file) / (1024*1024):.2f} MB")
        return True
    else:
        print(f"\n✗ 处理失败")
        if result.returncode != 0:
            print(f"  错误信息: {result.stderr.decode()}")
        return False


def main():
    # 配置参数
    input_dir = "/Users/jc/Downloads/agile_video"
    output_dir = "/Users/jc/Downloads/agile_video"

    print("=" * 60)
    print("视频横向拼接工具")
    print("=" * 60)
    print(f"输入目录: {input_dir}")
    print(f"输出目录: {output_dir}")
    print("=" * 60)
    print("\n拼接规则:")
    print("  - 常规对比类: input/原始 → GT → Ours → HOLD → MagicHOI")
    print("  - Rotate类: original → overlayed_objtexture → objtexture_rotateframe → rotateframe")
    print("  - Retarget类: {object}_cut_cut.mp4 → {timestamp}.mp4 (不裁剪)")
    print("=" * 60)

    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)

    # 获取所有子文件夹
    subfolders = get_subfolders(input_dir)

    if not subfolders:
        print("未找到任何子文件夹")
        return

    print(f"\n找到 {len(subfolders)} 个文件夹\n")

    # 处理每个文件夹
    success_count = 0
    failed_count = 0

    for folder in subfolders:
        folder_name = os.path.basename(folder)
        folder_type = classify_folder_type(folder_name)

        # 对retarget文件夹进行预处理
        if folder_type == 'retarget' and folder_name in ['ABF12_retarget', 'SM2_retarget']:
            preprocess_retarget_folder(folder, folder_name)

        # 对comparison文件夹进行预处理（SM4和GSF13）
        if folder_type == 'comparison' and folder_name in ['SM4', 'GSF13']:
            preprocess_comparison_folder(folder, folder_name)

        # 对dexycb文件夹进行预处理（去黑边和创建占位）
        if folder_name.startswith('dexycb'):
            preprocess_dexycb_folder(folder, folder_name)

        # 查找文件夹中的视频
        video_files = find_videos_in_folder(folder, folder_type, folder_name)

        if not video_files:
            print(f"跳过 {folder_name}: 没有视频文件")
            continue

        # 输出文件名
        output_file = os.path.join(output_dir, f"{folder_name}.mp4")

        # 创建横向拼接视频
        if create_hstack_video(video_files, output_file, folder_name, folder_type):
            success_count += 1
        else:
            failed_count += 1

    # 总结
    print("\n" + "=" * 60)
    print("处理完成!")
    print(f"成功: {success_count} 个")
    print(f"失败: {failed_count} 个")
    print(f"输出目录: {output_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()
