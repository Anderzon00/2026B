  const AUTO_MS = 5000;

function timelineEvents() {
    return document.querySelectorAll(".event");
}

function cards() {
    return document.querySelectorAll("#cardStage .card");
}

let currentIndex = 0;

// La altura del bloque de tarjetas es natural (auto): las tarjetas ocultas
// son display:none, así que no hace falta medirlas ni fijar altura por JS.
// El mecanismo anterior (medir -> fijar -> ResizeObserver) causaba temblor.

function setActiveDot(index) {
    var events = timelineEvents();
    if (events.length === 0) return;

    for (var i = 0; i < events.length; i++) {
        events[i].classList.remove("active");
    }

    var ev = events[index];
    if (ev) ev.classList.add("active");
}

function centerTimelineOn(index) {
    var timeline = document.getElementById("timelineEvents");
    if (!timeline) return;

    var events = timelineEvents();
    if (events.length === 0) return;

    var eventWidth = 150;
    var container = timeline.parentElement;
    if (!container) return;

    var containerWidth = container.offsetWidth;
    var totalEventsWidth = events.length * eventWidth;
    var targetScrollLeft = (index * eventWidth) - (containerWidth / 2) + (eventWidth / 2);
    var maxScrollLeft = Math.max(0, totalEventsWidth - containerWidth);
    var finalScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

    timeline.style.transform = 'translateX(-' + finalScrollLeft + 'px)';
}

function hideAllCards() {
    var allCards = cards();
    for (var i = 0; i < allCards.length; i++) {
        allCards[i].hidden = true;
    }
}

function pauseAllMedia() {
    var mediaBoxes = document.querySelectorAll(".media-box");

    for (var i = 0; i < mediaBoxes.length; i++) {
        var box = mediaBoxes[i];
        var state = getMediaState(box);
        state.paused = true;
        updateToggleText(box, state);
        stopMediaTimer(state);

        var videos = box.querySelectorAll("video");
        for (var j = 0; j < videos.length; j++) {
            try {
                videos[j].pause();
            } catch (e) {}
        }
    }
}

function showCard(index) {
    pauseAllMedia();
    hideAllCards();

    var c = document.getElementById('card-' + index);
    if (c) c.hidden = false;

    setActiveDot(index);
    centerTimelineOn(index);

    // Controlar visibilidad de coordinadores
    var coordinatorsBlock = document.getElementById('coordinatorsBlock');
    if (coordinatorsBlock) {
        if (index === 0) {
            coordinatorsBlock.classList.remove('hidden');
        } else {
            coordinatorsBlock.classList.add('hidden');
        }
    }

    if (c) {
        var mediaBox = c.querySelector(".media-box");
        if (mediaBox) startMediaAutoplay(mediaBox);
    }
}

function selectEvent(index) {
    var max = timelineEvents().length - 1;
    currentIndex = Math.max(0, Math.min(index, max));
    showCard(currentIndex);
}

function moveTimeline(direction) {
    selectEvent(currentIndex + direction);
}

// Carrusel
var mediaStates = new WeakMap();

function getMediaState(mediaBox) {
    if (!mediaStates.has(mediaBox)) {
        mediaStates.set(mediaBox, { idx: 0, paused: false, timer: null });
    }
    return mediaStates.get(mediaBox);
}

function getItems(mediaBox) {
    var viewport = mediaBox.querySelector(".image-carousel .media-viewport") || mediaBox.querySelector(".media-viewport");
    return viewport ? Array.from(viewport.querySelectorAll(".media-item")) : [];
}

function updateCounter(mediaBox, idx, total) {
    var counter = mediaBox.querySelector("[data-counter]");
    if (counter) counter.textContent = (idx + 1) + '/' + total;
}

function updateToggleText(mediaBox, state) {
    var btn = mediaBox.querySelector('[data-action="toggle"]');
    if (btn) btn.textContent = state.paused ? "Reanudar" : "Pausar";
}

function showMediaIndex(mediaBox, idx) {
    var items = getItems(mediaBox);
    if (items.length === 0) return;

    for (var i = 0; i < items.length; i++) {
        if (i === idx) {
            items[i].classList.add("active");
        } else {
            items[i].classList.remove("active");
        }
    }

    updateCounter(mediaBox, idx, items.length);
}

function stopMediaTimer(state) {
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
}

function nextMedia(mediaBox) {
    var state = getMediaState(mediaBox);
    var items = getItems(mediaBox);
    if (items.length <= 1) return;
    state.idx = (state.idx + 1) % items.length;
    showMediaIndex(mediaBox, state.idx);
}

function prevMedia(mediaBox) {
    var state = getMediaState(mediaBox);
    var items = getItems(mediaBox);
    if (items.length <= 1) return;
    state.idx = (state.idx - 1 + items.length) % items.length;
    showMediaIndex(mediaBox, state.idx);
}

function startMediaAutoplay(mediaBox) {
    var state = getMediaState(mediaBox);
    var items = getItems(mediaBox);

    state.idx = 0;
    state.paused = false;
    updateToggleText(mediaBox, state);
    showMediaIndex(mediaBox, state.idx);

    stopMediaTimer(state);

    if (items.length > 1) {
        state.timer = setInterval(function() {
            if (!state.paused) {
                nextMedia(mediaBox);
            }
        }, AUTO_MS);
    }
}

function wireMediaControls() {
    var mediaBoxes = document.querySelectorAll(".media-box");

    for (var i = 0; i < mediaBoxes.length; i++) {
        var mediaBox = mediaBoxes[i];
        var state = getMediaState(mediaBox);
        updateToggleText(mediaBox, state);

        var prevBtn = mediaBox.querySelector('[data-action="prev"]');
        var nextBtn = mediaBox.querySelector('[data-action="next"]');
        var toggleBtn = mediaBox.querySelector('[data-action="toggle"]');

        if (prevBtn) {
            prevBtn.addEventListener("click", function(box, st) {
                return function() {
                    st.paused = true;
                    updateToggleText(box, st);
                    prevMedia(box);
                };
            }(mediaBox, state));
        }

        if (nextBtn) {
            nextBtn.addEventListener("click", function(box, st) {
                return function() {
                    st.paused = true;
                    updateToggleText(box, st);
                    nextMedia(box);
                };
            }(mediaBox, state));
        }

        if (toggleBtn) {
            toggleBtn.addEventListener("click", function(box, st) {
                return function() {
                    st.paused = !st.paused;
                    updateToggleText(box, st);
                };
            }(mediaBox, state));
        }
    }

    var videos = document.querySelectorAll(".video-area video");
    for (var j = 0; j < videos.length; j++) {
        var v = videos[j];

        v.addEventListener("play", function(video) {
            return function() {
                var mediaBox = video.closest(".media-box");
                if (!mediaBox) return;
                var state = getMediaState(mediaBox);
                state.paused = true;
                updateToggleText(mediaBox, state);
                stopMediaTimer(state);
            };
        }(v));

        v.addEventListener("ended", function(video) {
            return function() {
                var mediaBox = video.closest(".media-box");
                if (!mediaBox) return;
                startMediaAutoplay(mediaBox);
            };
        }(v));
    }
}

window.addEventListener('resize', function() {
    centerTimelineOn(currentIndex);
});

document.addEventListener("DOMContentLoaded", function() {
    var circles = document.querySelectorAll('.circle');
    for (var i = 0; i < circles.length; i++) {
        circles[i].style.zIndex = 3;
    }

    wireMediaControls();

    selectEvent(0);
});