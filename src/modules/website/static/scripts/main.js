function scroll_down() {
    var pos = 0;
    for (var x of $(".head")) {
        if (x.offsetTop > pos) pos = x.offsetTop;
    }
    window.scrollTo({
        top: pos - 50,
        behavior: "smooth",
    });
}

$(document).ready(function () {
    $("#main-logo").addClass("shown");
    window.setTimeout(function () {
        $("#main-logo").removeClass("animated");
    }, 1000);

    $(".sidenav").sidenav();

    for (var time of document.querySelectorAll(".timestamp")) {
        time.innerHTML = new Date(
            parseInt(time.innerHTML) * 1000
        ).toLocaleString();
    }
});
