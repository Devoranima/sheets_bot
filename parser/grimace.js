const axios = require('axios');
const fs = require('fs');

const wallets = fs.readFileSync('./wallets.txt').toString().split(/[\r,\n]+/).filter(e => e != '');
const address = '0x2f90907fD1DC1B7a484b6f31Ddf012328c2baB28';
const wdoge = '';
const len = wallets.length;

(async function (){
    console.log('starting scanner...');
    clear('./result.txt')
    for (let i = 0; i < len; i++){
        console.log('scanning wallet ' + (i+1) + '/' + len + '...');
        const wallet = wallets[i]
        await parseData(wallet, i==(len-1));
    }
    console.log('all done, chief!');
})()

async function parseData(wallet, isLast){
    await axios.get('https://explorer.dogechain.dog/api', {
        params: {
            module:'account',
            action:'tokenbalance',
            contractaddress:address,
            address:wallet
        }
    }).then((response)=>{
        if (response.data.result){
            const value = (Math.round(response.data.result/(10**18)*100)/100)
            write('./result.txt', value + (isLast == 0 ? '\n' : ''));
        }
    })
    .catch(e=>{
        console.log('ERROR : network too busy...');
    })
}


//Write to file
function write(path_to_file, content){
    fs.writeFile(path_to_file, content, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
        }
    });
}

function clear(filename){
    fs.writeFile(filename, "", err =>{
        if (err) {
            console.error(err);
        }
    });
}