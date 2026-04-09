
// name your Tamagochi
let petName = localStorage.getItem("petName");


$('#setNameBtn').click(function() {
  petName = $('#nameField').val();
  localStorage.setItem("petName", petName);
  $("#displayName").html(petName);
  $("#care").show();
  $("#start").hide();
});

if (!localStorage.getItem("petName")) {
  $("#start").show();
} else {
  $("#displayName").html(localStorage.getItem("petName"));
  $("#care").show();
  $("#start").hide();
}

// Function to update meter color based on value (0-100)
function updateMeterColor(meterSelector, value) {
  let color = "green";
  if (value < 25) {
    color = "red";
  } else if (value < 50) {
    color = "yellow";
  }
  $(meterSelector).css("background-color", color);
}
// Example usage:
// updateMeterColor("#feedval", 40);
// updateMeterColor("#sleepval", 20);
// updateMeterColor("#playval", 60);

//localstorage timer

// Start a timer: an interval that reminds you to feed your tamagochi
setInterval(function () {
  // Change feedmeter by -5% each 10 seconds
  let currentFeedVal = parseInt($("#feedval").data("value")) || 100;
  currentFeedVal = Math.max(0, currentFeedVal - 5);
  $("#feedval").data("value", currentFeedVal);
  $("#feedval").css("width", currentFeedVal + "%");
  updateMeterColor("#feedval", currentFeedVal);

  // If value reaches 0, death
  if (currentFeedVal === 0) {
    $("#message").html("Oh no! Your tamagochi was not fed and is very sad!");
    // Optionally: clearInterval or trigger game over here
  } else if (currentFeedVal < 25) {
    $("#message").append(" feed me<br>");
  }
}, 10000);

//reminders function
//a interval that reminds you to sleep your tamagochi
setInterval(function () {message.innerHTML += "I'm tired<br>"}, 14000);
//a interval that reminds you to play your tamagochi
setInterval(function () {message.innerHTML += "play with me<br>"}, 16000);

//meter update function
// update feedmeter when below 25%
// update sleepmeter when below 25%
// update playmeter when below 25%
// update feedmeter when above 50%
// update sleepmeter when above 50%
// update playmeter when above 50%

// death function
//set death notice when anything at 0%
// make a new tama

//buttons function
// a button that feeds
// a button that sleeps
// a button that plays
