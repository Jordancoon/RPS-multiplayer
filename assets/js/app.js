/* ====================================
GLOBAL VARIABLES
======================================= */
// Development mode
// Enables "Clear DB" button and adds +3 to intelligence of developer
var devMode = true;
// Players
var players = {
  p1 : {
    key:    "",
    name:   "",
    wins:   0,
    losses: 0
  },
  p2 : {
    key:    "",
    name:   "",
    wins:   0,
    losses: 0
  }
};
var user = {
  role: "",
  key:  ""
};
// Turns and rounds
var turn = 0;
var round = 1;
var totalRounds = 5;
// connections
var connectionsCounter;
var p1key;
var p2key;

/* ====================================
FIREBASE
======================================= */
// Initialize Firebase
  var config = {
    apiKey: "AIzaSyCcaEXhv4mIMoQ5FG66iqB2yRIyZj38lmg",
    authDomain: "rps-multiplayer-5d14c.firebaseapp.com",
    databaseURL: "https://rps-multiplayer-5d14c.firebaseio.com",
    projectId: "rps-multiplayer-5d14c",
    storageBucket: "rps-multiplayer-5d14c.appspot.com",
    messagingSenderId: "22102044344"
  };
firebase.initializeApp(config);
var database = firebase.database();

// Check if there are already active players in the db
// In theory, this only matters for specators...
database.ref("/players").on("value", function(snapshot) {
  if (snapshot.child("1/name").exists()) {
    // save to global var
    players.p1.name = snapshot.child("1/name").val();
    // render to DOM
    $(".player1 h4").html(players.p1.name);
    // save connection keys
    p1key = snapshot.child("1/key").val();
  }
  if (snapshot.child("2/name").exists()) {
    // save to global var
    players.p2.name = snapshot.child("2/name").val();
    // render to DOM
    $(".player2 h4").html(players.p2.name);
    // save connection keys
    p2key = snapshot.child("2/key").val();
    // hide input but maintain height
    $("#joinForm").hide();
  }

});

// This is the "conductor" for the whole game.
// Everything depends on the value of "turn" (coming from the db)
// turn = 0, new game with no players
// turn = 1, player one's turn
// turn = 2, player two's turn
// turn = 3, results
database.ref("/game").on("value", function(turnsnap) {
  if(turnsnap.child("turn").exists()) {
    // console.log("Turn (from db): " + turnsnap.val().turn);
    switch (turnsnap.val().turn) {
      case 0:
        // new game, not programmed yet
        break;
      case 1:
        // show shoutbox
        $(".shoutbox").slideDown();
        // reset player choices
        resetChoices();
        // enable player1 buttons
        if (user.role === "player1") {
          status("Your turn. Choose your weapon!");
          $(".player1 button").css("visibility", "visible");
          enableChoices(user.role);
          disappear(".player2 button");
        }
        if (user.role === "player2") {
          status(players.p1.name+" is thinking...");
          disappear(".player1 button");
        }
        break;
      case 2:
        if (user.role === "player1") {
          status(players.p2.name+" is thinking...");
        }
        if (user.role === "player2") {
          // enable player2 buttons
          status("Your turn. Choose your weapon!");
          $(".player2 button").css("visibility", "visible");
          enableChoices(user.role);
        }
        break;
      case 3:
        // update status message
        status("Round complete!");
        // get choices from db
        var p1choice = turnsnap.val().p1choice.toLowerCase();
        var p2choice = turnsnap.val().p2choice.toLowerCase();
        // show choices made
        $(".card button").css("visibility", "visible");
        $(".player1 ."+p1choice).addClass('active');
        $(".player2 ."+p2choice).addClass('active');
        // show winner
        determineWinner(p1choice, p2choice);
        break;
    } // end switch
  }
});
// Shoutbox action
database.ref("/shoutbox").orderByChild("dateAdded").limitToLast(1).on("child_added", function(snapshot){
  var output = "<div class='shout'><span class='speaker'>";
  output += snapshot.val().name;
  output += ":</span> <span class='shoutContent'>";
  output += snapshot.val().message;
  output += "</span></div>";
  $(".shouts").append(output);
});

// Handling disconnects
// connectionsRef references a specific location in our database.
// All of our connections will be stored in this directory.
var connectionsRef = database.ref("/connections");
var connectedRef = database.ref(".info/connected");

// When the client's connection state changes...
connectedRef.on("value", function(snap) {
  // console.log("Current user role: "+user.role);
  // If they are connected..
  if (snap.val()) {
    // Add user to the connections list.
    var con = connectionsRef.push(true);
    // set local user key to connection key
    user.key = con.key;
    // Remove user from the connection list when they disconnect.
    con.onDisconnect().remove();
  }
});

// When first loaded or when the connections list changes...
connectionsRef.on("value", function(snap) {
  // Display the viewer count in the html.
  // The number of online users is the number of children in the connections list.
  $("#watchers").html("Current users: "+snap.numChildren());
});

connectionsRef.on("child_removed", function(removed) {
  // if the key of removed child matches one of the players, remove them
  if (removed.key === p1key) {
    status(players.p1.name + " disconnected!");
    // clear on db
    database.ref("/players/1").remove();
    // clear locally so new player can be added
    players.p1.name = "";
    if(user.role!=="player2") {
      $("#joinForm").show();
    }
    user.role = "";
    resetRound();
  } else if(removed.key === p2key) {
    status(players.p2.name + " disconnected!");
    database.ref("/players/2").remove();
    // clear locally so new player can be added
    players.p2.name = "";
    if(user.role!=="player1") {
      $("#joinForm").show();
    }
    user.role = "";
    resetRound();
  }
});
/* ====================================
FUNCTIONS
======================================= */
// Hide element but maintain height in the DOM
function disappear(e) {
  $(e).css("visibility", "hidden");
}
// Convert string to title case
// https://stackoverflow.com/q/196972/3424316
function toTitleCase(str)
{
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
// Disable player choices
function disableChoices(player) {
  $(player).prop("disabled", true);
  $(player).siblings().prop("disabled", true);
}
// Enable player choices
function enableChoices(player) {
  $("."+player+" button").prop("disabled", false);
}
// Update status message
function status(msg) {
  $(".status").html(msg);
}
// Clear results panel
function clearResults() {
  $(".result .card-text").html("");
}
// Who won the round?
function determineWinner(a, b) {
  if (a === b) {
    $(".result .card-text").html("It's a tie!");
  } else if (a === "rock" && b === "paper") {
    $(".result .card-text").html(players.p2.name+ " wins!");
    players.p1.losses++;
    players.p2.wins++;
  } else if (a === "rock" && b === "scissors") {
    $(".result .card-text").html(players.p1.name+" wins!");
    players.p1.wins++;
    players.p2.losses++;
  } else if (a === "paper" && b === "rock") {
    $(".result .card-text").html(players.p1.name+" wins!");
    players.p1.wins++;
    players.p2.losses++;
  } else if (a === "paper" && b === "scissors") {
    $(".result .card-text").html(players.p2.name+" wins!");
    players.p1.losses++;
    players.p2.wins++;
  } else if (a === "scissors" && b === "rock") {
    $(".result .card-text").html(players.p2.name+" wins!");
    players.p1.losses++;
    players.p2.wins++;
  } else if (a === "scissors" && b === "paper") {
    $(".result .card-text").html(players.p1.name+" wins!");
    players.p1.wins++;
    players.p2.losses++;
  }
  $("#scorePlayer1").html("Wins: "+players.p1.wins+" / Losses: "+players.p1.losses);
  $("#scorePlayer2").html("Wins: "+players.p2.wins+" / Losses: "+players.p2.losses);
  database.ref("/players/1").update({
    wins  : players.p1.wins,
    losses: players.p1.losses
  });
  database.ref("/players/2").update({
    wins  : players.p2.wins,
    losses: players.p2.losses
  });
  // after 3 seconds, reset the round
  setTimeout(resetRound, 3000);
}
// Reset the round (not the entire game)
function resetRound() {
  // console.log("RESET!");
  turn = 1;
  database.ref("/game").update({
    turn      : turn,
    p1choice  : "",
    p2choice  : ""
  });
  resetChoices();
  clearResults();
}
// Reset choice buttons to initial states
function resetChoices(){
  $(".card button").removeClass('active');
}



/* ====================================
GAME
======================================= */
$(document).ready(function() {

  // Player registration
  $("#joinForm").submit(function(event){
    // don't refresh page on submit
    event.preventDefault();
    if (players.p1.name==="") {
      players.p1.name = toTitleCase($("#nameInput").val().trim());
      // set user global variable to player 1
      user.role = "player1";

      // write name to DOM
      $(".player1 h4").html(players.p1.name);
      status("Hi, "+players.p1.name+"! You're player 1. Waiting for another player to join.");
      // write player name to db
      database.ref("/players/1").update({
        key   : user.key,
        name  : players.p1.name,
        wins  : players.p1.wins,
        losses: players.p1.losses
      });
      //
      turn = 0;
      database.ref("/game").update({
        turn: turn
      });

      $(this).hide();
    } else if (players.p2.name===""){
      players.p2.name = toTitleCase($("#nameInput").val().trim());
      // set user global variable to player 2
      user.role = "player2";
      // write name to DOM
      $(".player2 h4").html(players.p2.name);
      // write player name to db
      database.ref("/players/2").update({
        key   : user.key,
        name  : players.p2.name,
        wins  : players.p2.wins,
        losses: players.p2.losses
      });
      status("Hey, "+players.p2.name+"! You're player 2. Waiting for "+players.p1.name+" to make a move.");
      // start game by storing turn in database
      turn = 1;
      database.ref("/game").update({
        turn: turn
      });
    }
    // console.log(user.role);
  });

  // Player R/P/S choice
  $(".player button").click(function(){
    $(this).addClass('active');
    var choice = $(this).text();
    var parent = $(this).parent().parent();
    disableChoices(this);
    if (parent.hasClass("player1")) {
      // set turn to 2 for player 2
      turn = 2;
      // store values in db
      database.ref("/game").update({
        p1choice  : choice,
        turn      : turn
      });
      status("Your choice is locked in. Waiting on "+players.p2.name+"...");
    } else {
      // set turn to 3 for results
      turn = 3;
      database.ref("/game").update({
        // store values in db
        p2choice  : choice,
        turn      : turn
      });
    }
  });

  $("#shoutForm").submit(function(event){
    event.preventDefault();
    var message = $("#shoutMessage").val().trim();
    // clear input
    $("#shoutMessage").val("");
    var shoutUser;
    if(user.role==="player1") {
      shoutUser = players.p1.name;
    } else if (user.role==="player2") {
      shoutUser = players.p2.name;
    }
    database.ref("/shoutbox").push({
      name    : shoutUser,
      message : message
    });

  });

  if(devMode) {
    $("#clearButton").show();
    $("#clearButton").click(function(event){
      event.preventDefault();
      database.ref().remove()
      .then(function() {
        // console.log("Reset succeeded.");
        location.reload();
      });

    });
    // $(".devModeBanner").show();
  }

}); // document ready