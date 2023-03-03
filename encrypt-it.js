console.log("Window loaded!");
function handleClick() {
    const textarea = document.getElementById("input");
    const plaintext = textarea.value;
    const ciphertext = shiftCipher(plaintext);
    const output = document.getElementById("output");
    output.textContent = ciphertext;
  }
  
  function shiftCipher(plaintext) {
    let ciphertext = "";
    for (let i = 0; i < plaintext.length; i++) {
      let charCode = plaintext.charCodeAt(i);
      if (charCode >= 65 && charCode <= 90) { // uppercase letters
        charCode = ((charCode - 65 + 1) % 26) + 65;
      } else if (charCode >= 97 && charCode <= 122) { // lowercase letters
        charCode = ((charCode - 97 + 1) % 26) + 97;
      }
      ciphertext += String.fromCharCode(charCode);
    }
    return ciphertext;
  }
  
  window.addEventListener("load", function() {
    const button = document.getElementById("encrypt-button");
    button.addEventListener("click", handleClick);
  });
  