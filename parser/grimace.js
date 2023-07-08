const axios = require('axios');
const fs = require('fs');

const wallets = fs.readFileSync('./wallets.txt').toString().split(/[\r,\n]+/).filter(e => e != '');
const address = '0x2f90907fD1DC1B7a484b6f31Ddf012328c2baB28';
const len = wallets.length;

(async function (){
    console.log('starting scanner...');
    clear('./result.txt')
    for (let i = 0; i < len; i++){
        console.log('scanning wallet ' + (i+1) + '/' + len + '...');
        const wallet = wallets[i];
        const balance = await parseGrimaceBalance(wallet);
        if (balance !== null && balance >= 0){
            write('./result.txt', balance + ( i !== (len-1) ? '\n' : ''));
        }
    }
    console.log('all done, chief!');
})()

async function parseGrimaceBalance(wallet){
    const result = await axios.get('https://explorer.dogechain.dog/api', {
        params: {
            module:'account',
            action:'tokenbalance',
            contractaddress:address,
            address:wallet
        }
    }).then((response)=>{
        if (response.data.result){
            const value = (Math.round(response.data.result/(10**18)*100)/100);
            return value;
        }
        return null;
    })
    .catch(e=>{
        console.log('ERROR : network too busy...');
        return null;
    })

    return result;
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