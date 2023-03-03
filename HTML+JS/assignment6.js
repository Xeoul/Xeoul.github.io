var alphabet = "abcdefghijklmnopqrstuvwxyz";

var newalpha="";

function shift(n)

{

for(let i-0;i<alphabet.length;i++)

{

let offset=(i+n)%alphabet.length;

newalpha+=alphabet[offset];

}