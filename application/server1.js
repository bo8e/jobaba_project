'use strict';

// 1. 서버세팅
var express = require('express');
var path = require('path');
var fs = require('fs');

// 2. fabric 연결설정
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');

const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('./javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('./javascript/AppUtil.js');

const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');

const ccp = buildCCPOrg1();
const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

// 3. 미들웨어 설정
var app = express();

// static /public -> ./public
app.use('/html', express.static(path.join(__dirname,'html')));

// body-parser app.use
app.use(express.urlencoded({ extended : false}));
app.use(express.json());

// 4. /admin POST 라우팅
app.post('/admin', async (req, res) => {
    const id = req.body.adminid;
    const adminpw = req.body.passwd;

    console.log(id, adminpw);

    try {

		const wallet = await buildWallet(Wallets, walletPath);

        const identity = await wallet.get(id);
        if (identity) {
            console.log('An identity for the admin user admin already exists in the wallet');
            var result = '{"result":"failed", "msg":"An identity for the admin user admin already exists in the wallet"}'
            res.json(JSON.parse(result));
            return;
        }
        // 5. admin등록
        const enrollment = await caClient.enroll({ enrollmentID: id, enrollmentSecret: adminpw });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put(id, x509Identity);

        console.log('Successfully enrolled admin user and imported it into the wallet');
        var result = '{"result":"success", "msg":"Successfully enrolled admin user and imported it into the wallet"}'
        res.status(200).json(JSON.parse(result));

    } catch (error) {
        console.error(`Failed to enroll admin user : ${error}`);
        var result = '{"result":"failed", "msg":"Failed to enroll admin user in try/catch"}'
        res.json(JSON.parse(result));
    }
});


// 5. /user POST 라우팅
app.post('/user', async (req, res) => {
    var id = req.body.userid;
    var userrole = req.body.userrole;

    console.log("/user start -- ", id, userrole);

    try {
		const wallet = await buildWallet(Wallets, walletPath);

        const userIdentity = await wallet.get(id);
        if (userIdentity) {
            console.log(`An identity for the user ${id} already exists in the wallet`);
            var result = `{"result":"fail", "msg":"An identity for the user ${id} already exists in the wallet"}`;
            var obj = JSON.parse(result);
            console.log("/user end -- failed");
            res.status(200).send(obj);
            return;
        }

        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            var result = `{"result":"fail", "msg":"An identity for the admin user admin does not exist in the wallet"}`;
            var obj = JSON.parse(result);
            console.log("/user end -- failed");
            res.status(200).send(obj);
            return;
        }

        // build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await caClient.register({
            affiliation: 'org1.department1',
            enrollmentID: id,
            role: userrole
        }, adminUser);
        const enrollment = await caClient.enroll({
            enrollmentID: id,
            enrollmentSecret: secret
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };

        await wallet.put(id, x509Identity);
        console.log('Successfully registered and enrolled admin user "appUser" and imported it into the wallet');

    } catch (error) {

        var result = `{"result":"fail", "msg":"Error occured in try/catch in registering userid : ${id}"}`;
        var obj = JSON.parse(result);
        console.log(`/user end -- failed : ${error}`);
        res.status(200).send(obj);
        //선생님이 생각해내셨습니다.
        return;
    }

    var result = `{"result":"success", "msg":"Successfully registered and enrolled admin user ${id} and imported it into the wallet"}`;
    var obj = JSON.parse(result);
    console.log("/user end -- success");
    res.status(200).send(obj);

});

app.get('/user/list', async (req, res) => {

    console.log("/user/list start -- ");

    let wlist;
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        wlist = await wallet.list();

    } catch (error) {
        var result = `{"result":"fail", "id":{"/user/list"}}`;
        var obj = JSON.parse(result);
        console.log("/user/list end -- failed");
        res.status(200).send(obj);
        return;
    }

    var result = `{"result":"success", "id":"${wlist}"}`;
    var obj = JSON.parse(result);
    console.log("/user/list end -- success");
    res.status(200).send(obj);

});


// 6. /asset POST 라우팅
app.post('/stock/register', async(req, res) =>{
    //id , price , seller_shop , info 
    var userid = req.body.userid;
    var rid = req.body.rid;
    var price = req.body.price;
    var seller_shop = req.body.seller_shop;
    var info = req.body.info;

    console.log("/stock/register post start -- ", userid, rid , price , seller_shop , info );
    const gateway = new Gateway();

    try {
        const wallet = await buildWallet(Wallets, walletPath);

        await gateway.connect(ccp, {
            wallet,
            identity: userid,
            discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
        });
        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("jobaba");
        await contract.submitTransaction('RegisterStock', rid , price , seller_shop , info);

    } catch (error) {
        var result = `{"result":"fail", "message":"tx has NOT submitted"}`;
        var obj = JSON.parse(result);
        console.log("/stock/register end -- failed ", error);
        res.status(200).send(obj);
        return;
    }finally {
         gateway.disconnect();
    }

    var result = `{"result":"success", "message":"tx has submitted"}`;
    var obj = JSON.parse(result);
    console.log("/stock/register end -- success");
    res.status(200).send(obj);
});

// 7. /asset GET 라우팅
app.get('/stock/register', async(req, res) =>{
    var userid = req.query.userid;
    var key = req.query.key;
    console.log("/stock/register get start -- ", userid, key);

    const gateway = new Gateway();

    try {
        const wallet = await buildWallet(Wallets, walletPath);
		// GW -> connect -> CH -> CC -> submitTransaction
        await gateway.connect(ccp, {
            wallet,
            identity: userid,
            discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed 
        });
        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("jobaba");
        var result = await contract.evaluateTransaction('QueryStock',key);
        // result 가 byte array라고 생각하고
        var result = `{"result":"success", "message":${result}}`;
        console.log("/asset get end -- success", result);
        var obj = JSON.parse(result);
        res.status(200).send(obj);
    } catch (error) {
        var result = `{"result":"fail", "message":"Get has a error"}`;
        var obj = JSON.parse(result);
        console.log("/asset get end -- failed ", error);
        res.status(200).send(obj);
        return;
    } finally {
        gateway.disconnect();
    }
});

app.post('/stock/request', async(req, res) =>{
    //id , price , seller_shop , info 
    var userid = req.body.userid;
    var rid = req.body.rid;
    var buyer = req.body.buyer;

    console.log("/stock/request post start -- ", userid, rid, buyer );
    const gateway = new Gateway();

    try {
        const wallet = await buildWallet(Wallets, walletPath);

        await gateway.connect(ccp, {
            wallet,
            identity: userid,
            discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
        });
        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("jobaba");
        await contract.submitTransaction('RequestStock', rid, buyer);

    } catch (error) {
        var result = `{"result":"fail", "message":"tx has NOT submitted"}`;
        var obj = JSON.parse(result);
        console.log("//stock/request end -- failed ", error);
        res.status(200).send(obj);
        return;
    }finally {
         gateway.disconnect();
    }

    var result = `{"result":"success", "message":"tx has submitted"}`;
    var obj = JSON.parse(result);
    console.log("//stock/request end -- success");
    res.status(200).send(obj);
});

app.post('/stock/confirm', async(req, res) =>{
    //id , price , seller_shop , info 
    var userid = req.body.userid;
    var rid = req.body.rid;
    var seller = req.body.seller;

    console.log("/stock/confirm post start -- ", userid, rid, seller );
    const gateway = new Gateway();

    try {
        const wallet = await buildWallet(Wallets, walletPath);

        await gateway.connect(ccp, {
            wallet,
            identity: userid,
            discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
        });
        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("jobaba");
        await contract.submitTransaction('ConfirmStock', rid, seller);

    } catch (error) {
        var result = `{"result":"fail", "message":"tx has NOT submitted"}`;
        var obj = JSON.parse(result);
        console.log("/stock/confirm end -- failed ", error);
        res.status(200).send(obj);
        return;
    }finally {
         gateway.disconnect();
    }

    var result = `{"result":"success", "message":"tx has submitted"}`;
    var obj = JSON.parse(result);
    console.log("/stock/confirm end -- success");
    res.status(200).send(obj);
});


app.get('/stock/history', async(req, res) =>{
    var userid = req.query.userid;
    var key = req.query.key;
    console.log("/asset/history get start -- ", userid, key);

    const gateway = new Gateway();

    try {
        const wallet = await buildWallet(Wallets, walletPath);
		// GW -> connect -> CH -> CC -> submitTransaction
        await gateway.connect(ccp, {
            wallet,
            identity: userid,
            discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed 
        });
        const network = await gateway.getNetwork("mychannel");
        const contract = network.getContract("jobaba");
        var result = await contract.evaluateTransaction('GetHistory',key);
        // result 가 byte array라고 생각하고
        var result = `{"result":"success", "message":${result}}`;
        console.log("/asset get end -- success", result);
        var obj = JSON.parse(result);
        res.status(200).send(obj);
    } catch (error) {
        var result = `{"result":"fail", "message":"Get history has a error"}`;
        var obj = JSON.parse(result);
        console.log("/asset get end -- failed ", error);
        res.status(200).send(obj);
        return;
    } finally {
        gateway.disconnect();
    }
});
// *. 루트 라우팅
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/html/index.html');
});

// 8. 서버 listen (서버시작)
app.listen(3000, () => {
    console.log('Express server is started: 3000');
});