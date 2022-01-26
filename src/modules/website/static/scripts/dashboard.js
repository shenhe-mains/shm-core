$(document).ready(function () {
    var hours = -(new Date().getTimezoneOffset() / 60);
    if (hours == 0) {
        $("#offset").html("Your timezone is the same as UTC.");
    } else {
        $("#offset").html(
            "You are " +
                Math.abs(hours) +
                " hour" +
                (Math.abs(hours) == 1 ? "" : "s") +
                " " +
                (hours > 0 ? "ahead of" : "behind") +
                " UTC."
        );
    }
});

function view_user(path) {
    const id = prompt("Please enter the user ID.");
    if (!id) return;
    if (!id.match(/^\d+$/)) {
        alert("That is not a valid user ID.");
        return;
    }
    window.location = "/dashboard/" + path + "/" + id;
}

function view_modmail() {
    view_user("modmail");
}

function view_applications() {
    view_user("all-applications");
}
