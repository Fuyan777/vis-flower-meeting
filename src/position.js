const positionArray = []

let x = 0; // 水平方向
let y = 0; // 垂直方向

for (let i=0; i<8; i++) {
    for (let j=0; j<8; j++) {
        x = j * 60;
        y = i * 60;
        positionArray.push({
            id: null,
            x: x, y: y,
            status: false,
            image: null
        })
    }
}

for (let index=0; index<64; index++) {
    positionArray[index].id = index
}

console.log(positionArray);

export default positionArray;