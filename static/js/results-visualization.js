// Results Visualization Script

// Video data structure
const videos = {
    reconstruction: [
        {src: 'static/videos/ABF12.mp4', thumb: 'static/videos/ABF12/ABF12_cut.mp4', label: 'ABF12', hasGT: true},
        {src: 'static/videos/GSF13.mp4', thumb: 'static/videos/GSF13/GSF13_cut.mp4', label: 'GSF13', hasGT: true},
        {src: 'static/videos/SM4.mp4', thumb: 'static/videos/SM4/SM4_cut.mp4', label: 'SM4', hasGT: true},
        {src: 'static/videos/MDF12.mp4', thumb: 'static/videos/MDF12/MDF12_cut.mp4', label: 'MDF12', hasGT: true},
        {src: 'static/videos/dexycb_01_resized.mp4', thumb: 'static/videos/dexycb_01/input_dexycb_01_20200709_141754_836212060125_cut_cropped.mp4', label: 'DexYCB-01', hasGT: true},
        {src: 'static/videos/dexycb_03_resized.mp4', thumb: 'static/videos/dexycb_03/input_dexycb_03_20200820_143330_836212060125_cut_cropped.mp4', label: 'DexYCB-03', hasGT: true},
        {src: 'static/videos/dexycb_07_resized.mp4', thumb: 'static/videos/dexycb_07/input_dexycb_07_144300_836212060125_cut_cropped.mp4', label: 'DexYCB-07', hasGT: true},
        {src: 'static/videos/bottle1.mp4', thumb: 'static/videos/bottle1/gt_bottle1.mp4', label: 'Bottle', hasGT: false},
        {src: 'static/videos/controller1.mp4', thumb: 'static/videos/controller1/gt_controller1_cut_cut_2.mp4', label: 'Controller', hasGT: false},
    ],
    rotation: [
        {src: 'static/videos/ABF12_rotate.mp4', thumb: 'static/videos/ABF12_rotate/ABF12_original.mp4', label: 'ABF12'},
        {src: 'static/videos/GSF13_rotate.mp4', thumb: 'static/videos/GSF13_rotate/GSF13_original.mp4', label: 'GSF13'},
        {src: 'static/videos/pen4_rotate.mp4', thumb: 'static/videos/pen4_rotate/genhoi_pen4_original.mp4', label: 'Pen'},
        {src: 'static/videos/SM2_rotate.mp4', thumb: 'static/videos/SM2_rotate/SM2_original.mp4', label: 'SM2'},
        {src: 'static/videos/BB12_rotate.mp4', thumb: 'static/videos/BB12_rotate/BB12_original.mp4', label: 'BB12'},
        {src: 'static/videos/controller1_rotate.mp4', thumb: 'static/videos/controller1_rotate/genhoi_controller1_original.mp4', label: 'Controller'},
        {src: 'static/videos/toycar1_rotate.mp4', thumb: 'static/videos/toycar1_rotate/hold_toycar1_itw_original.mp4', label: 'Toy Car'}
    ],
    retarget: [
        {src: 'static/videos/ABF12_retarget.mp4', thumb: 'static/videos/ABF12_retarget/ABF12_cut_cut_cut_trimmed.mp4', label: 'ABF12'},
        {src: 'static/videos/SM2_retarget.mp4', thumb: 'static/videos/SM2_retarget/SM2_cut_cut_trimmed.mp4', label: 'SM2'}
    ]
};

// Switch visualization mode
document.addEventListener('DOMContentLoaded', function() {
    // Initialize showcase for reconstruction
    loadShowcase('reconstruction');

    // Add click handlers to viz buttons
    document.querySelectorAll('.viz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const vizType = btn.dataset.viz;

            // Update button states
            document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content visibility
            document.querySelectorAll('.viz-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`viz-${vizType}`).classList.add('active');

            // Load thumbnails
            loadShowcase(vizType);
        });
    });

    // Add navigation arrow handlers
    document.querySelectorAll('.showcase-nav').forEach(nav => {
        nav.addEventListener('click', () => {
            const showcaseId = nav.dataset.showcase;
            const showcase = document.getElementById(`showcase-${showcaseId}`);
            if (!showcase) return;

            const scrollAmount = 300; // Scroll by 300px
            const direction = nav.classList.contains('showcase-nav-left') ? -1 : 1;

            showcase.scrollBy({
                left: scrollAmount * direction,
                behavior: 'smooth'
            });
        });
    });

    // Update alignment on window resize
    window.addEventListener('resize', () => {
        const activeContent = document.querySelector('.viz-content.active');
        if (activeContent) {
            const vizType = activeContent.id.replace('viz-', '');
            updateShowcaseAlignment(vizType);
            updateNavArrows(vizType);
        }
    });
});

// Load showcase thumbnails
function loadShowcase(vizType) {
    const showcase = document.getElementById(`showcase-${vizType}`);
    const mainVideo = document.getElementById(`main-video-${vizType}`);

    if (!showcase || !mainVideo) return;

    showcase.innerHTML = '';
    videos[vizType].forEach((video, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'showcase-thumb' + (index === 0 ? ' active' : '');

        const thumbVideo = document.createElement('video');
        thumbVideo.muted = true;
        thumbVideo.loop = true;
        thumbVideo.preload = 'metadata';

        const source = document.createElement('source');
        // Use thumbnail video if available, otherwise use main video
        source.src = (video.thumb || video.src) + '#t=0.1';
        source.type = 'video/mp4';
        thumbVideo.appendChild(source);

        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = video.label;

        thumb.appendChild(thumbVideo);
        thumb.appendChild(label);

        thumb.addEventListener('click', () => {
            mainVideo.src = video.src;
            mainVideo.load();
            mainVideo.play();

            // Update active state
            showcase.querySelectorAll('.showcase-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');

            // Show/hide method labels for reconstruction videos
            updateMethodLabels(vizType, video);
        });

        // Play thumbnail video on hover
        thumb.addEventListener('mouseenter', () => {
            thumbVideo.play();
        });

        thumb.addEventListener('mouseleave', () => {
            thumbVideo.pause();
            thumbVideo.currentTime = 0;
        });

        showcase.appendChild(thumb);
    });

    // Initialize method labels for first video
    if (videos[vizType].length > 0) {
        updateMethodLabels(vizType, videos[vizType][0]);
    }

    // Check if content overflows and update class
    updateShowcaseAlignment(vizType);

    // Update navigation arrows state
    updateNavArrows(vizType);

    // Add scroll listener to update arrows
    showcase.addEventListener('scroll', () => {
        updateNavArrows(vizType);
    });
}

// Check if showcase content overflows and update alignment
function updateShowcaseAlignment(vizType) {
    const showcase = document.getElementById(`showcase-${vizType}`);
    if (!showcase) return;

    // Check if content width exceeds container width
    if (showcase.scrollWidth > showcase.clientWidth) {
        showcase.classList.add('overflow');
    } else {
        showcase.classList.remove('overflow');
    }
}

// Update navigation arrows state based on scroll position
function updateNavArrows(vizType) {
    const showcase = document.getElementById(`showcase-${vizType}`);
    if (!showcase) return;

    const leftArrow = document.querySelector(`.showcase-nav-left[data-showcase="${vizType}"]`);
    const rightArrow = document.querySelector(`.showcase-nav-right[data-showcase="${vizType}"]`);

    if (!leftArrow || !rightArrow) return;

    // Check if content overflows - hide arrows if it doesn't
    const hasOverflow = showcase.scrollWidth > showcase.clientWidth;

    if (!hasOverflow) {
        leftArrow.style.display = 'none';
        rightArrow.style.display = 'none';
        return;
    } else {
        leftArrow.style.display = 'flex';
        rightArrow.style.display = 'flex';
    }

    // Check if scrolled to the start
    if (showcase.scrollLeft <= 0) {
        leftArrow.classList.add('disabled');
    } else {
        leftArrow.classList.remove('disabled');
    }

    // Check if scrolled to the end
    const maxScroll = showcase.scrollWidth - showcase.clientWidth;
    if (showcase.scrollLeft >= maxScroll - 1) {
        rightArrow.classList.add('disabled');
    } else {
        rightArrow.classList.remove('disabled');
    }
}

// Update method labels visibility based on video type
function updateMethodLabels(vizType, video) {
    const labelsDiv = document.getElementById(`method-labels-${vizType}`);
    if (!labelsDiv) return;

    // Show labels for all reconstruction videos
    if (vizType === 'reconstruction') {
        labelsDiv.classList.add('active');

        // Update label content based on whether video has GT
        if (video.hasGT) {
            // 5 methods: Input Video, GT, Ours, HOLD, MagicHOI
            labelsDiv.innerHTML = `
                <span>Input Video</span>
                <span>GT</span>
                <span><strong>Ours</strong></span>
                <span>HOLD<d-cite key="fan2024hold"></d-cite></span>
                <span>MagicHOI<d-cite key="wang2025magichoi"></d-cite></span>
            `;
        } else {
            // 4 methods: Input Video, Ours, HOLD, MagicHOI
            labelsDiv.innerHTML = `
                <span>Input Video</span>
                <span><strong>Ours</strong></span>
                <span>HOLD<d-cite key="fan2024hold"></d-cite></span>
                <span>MagicHOI<d-cite key="wang2025magichoi"></d-cite></span>
            `;
        }
    } else {
        labelsDiv.classList.remove('active');
    }
}
