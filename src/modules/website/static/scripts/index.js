var carousel_index = 0;
var carousels;

var countdown = 10;

var dragging = false;
var start_x = undefined;
var mod_pos = 0;

function s_if(x) {
    return x == 1 ? "" : "s";
}

function show_shenhe() {
    if ($(window).scrollTop() > window.innerHeight * 0.2) {
        $("#discord-left").removeClass("off-screen");
        $(window).off("scroll.show_shenhe");
        $("body").off("touchmove.show_shenhe");
    }
}

function carousel_move(delta) {
    [...document.querySelectorAll(".carousel-" + carousel_index)].forEach(
        function (e) {
            e.classList.add("hidden");
        }
    );
    [...document.querySelectorAll(".slide-index-" + carousel_index)].forEach(
        function (e) {
            e.classList.add("slide-button-unselected");
        }
    );

    carousel_index += delta + carousels;
    carousel_index %= carousels;

    [...document.querySelectorAll(".carousel-" + carousel_index)].forEach(
        function (e) {
            e.classList.remove("hidden");
        }
    );
    [...document.querySelectorAll(".slide-index-" + carousel_index)].forEach(
        function (e) {
            e.classList.remove("slide-button-unselected");
        }
    );

    countdown = 10;
}

function carousel_set(item) {
    carousel_move(item - carousel_index);
}

function carousel_tick() {
    --countdown;
    if (countdown <= 0) {
        carousel_move(1);
    }
}

function getX(e) {
    if (
        e.type == "touchstart" ||
        e.type == "touchmove" ||
        e.type == "touchend" ||
        e.type == "touchcancel"
    ) {
        return (e.originalEvent.touches[0] || e.originalEvent.changedTouches[0])
            .pageX;
    } else {
        return e.clientX;
    }
}

function start_drag(event) {
    dragging = true;
    start_x = getX(event);
}

function move_drag(event) {
    var current_x = getX(event);
    if (dragging) {
        if (current_x - start_x > window.innerWidth / 10) {
            carousel_move(1 - mod_pos);
            mod_pos = 1;
        } else if (current_x - start_x < -window.innerWidth / 10) {
            carousel_move(-1 - mod_pos);
            mod_pos = -1;
        } else {
            carousel_move(-mod_pos);
            mod_pos = 0;
        }
    }
}

function end_drag(event) {
    dragging = false;
    mod_pos = 0;
    start_x = undefined;
}

$(document).ready(function () {
    carousels = document.querySelectorAll(".carousel").length / 2;

    $(window).on("scroll.show_shenhe", show_shenhe);
    $("body").on("touchmove.show_shenhe", show_shenhe);

    $(".carousel-container").mousedown(start_drag).on("touchstart", start_drag);
    $(window).mousemove(move_drag).mouseup(end_drag);
    $("body").on("touchmove", move_drag).on("touchend", end_drag);

    window.setInterval(carousel_tick, 1000);

    var seconds = Math.floor(1641351600 - new Date().getTime() / 1000);
    var task = window.setInterval(
        ((f) => (f(f), f))(function (f) {
            if (seconds <= 0) {
                $("#countdown").html("Shenhe is here!");
                window.clearInterval(task);
                return;
            }
            var s = seconds;
            var m = Math.floor(s / 60);
            s %= 60;
            var h = Math.floor(m / 60);
            m %= 60;
            var d = Math.floor(h / 24);
            h %= 24;
            $("#countdown").html(
                `${d} day${s_if(d)} ${h} hour${s_if(h)} ${m} minute${s_if(
                    m
                )} ${s} second${s_if(s)}`
            );
            --seconds;
        }),
        1000
    );
});
