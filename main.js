var d3; // Minor workaround to avoid error messages in editors

// Waiting until document has loaded
window.onload = () => {

  // Loading the dataset
  fetch('data/football.json')
    .then((response) => response.json())
    .then((json) => console.log(json));

  // YOUR CODE GOES HERE
  console.log("YOUR CODE GOES HERE");
  
};
