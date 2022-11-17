<template>
  <div id="app">
    <div class="gardening">
      <h2>■ フィードバック</h2>
      <div class="flower-block" :style="{position: `relative`}">
        <img id="bed" :src="require(`@/assets/flower-bed.png`)" width="535">
        <!-- 花の表示 -->
        <div class="flower" v-for="(item, index) in displayFlowerPostionArray" :key="`red-${index}`">
          <img
            id="flower-red"
            width="50"
            v-if="item.status"
            :src="item.image"
            :style="{position: 'absolute', top: gardenPadding + item.y + 'px', left: gardenPadding + item.x + 'px' }"
          >
        </div>
      </div>
      <div class="setting-block">
        <div class="player-status">
          <h3>1. プレイヤー設定：{{ playerStatusText }}</h3>
          <button
            v-for="btn in playerSettingButtons" 
            :key="btn.id"
            @click="setPlayer(btn)">{{btn.title}}:{{ btn.color }}
          </button>
        </div>
        <div class="feedback-control">
          <h3>2. DB接続: {{ dbConnectionStatusText }}</h3>
          <button class="test-start-button" v-on:click="startFeedback">Start</button>
          <button class="test-stop-button" v-on:click="stopFeedback">Stop</button>
        </div>
        <div class="tracking-control">
          <h3>3. 会話行動検知: {{ trackingStatusText }}</h3>
          <button class="test-start-button" v-on:click="startAllTracking">Start</button>
          <button class="test-stop-button" v-on:click="stopAllTracking">Stop</button>
        </div>
      </div>
    </div>
    <div class="debug-setting-block">
      <h2>■ デバッグ: {{ isDebug }}</h2>
      <div class="count-all">
        <li>発話回数   ：{{ speechCount }}</li>
        <li>頷き回数   ：{{ nodCount }}</li>
        <li>予備動作回数：{{ motivationCount }}</li>
        <button class="test-all-debug-button" v-on:click="startDebug">Debug Start</button>
        <button class="test-all-reset-button" v-on:click="resetCountPlayer">Reset Count</button>
      </div>
      <div class="speech" v-bind="speechCount">
        <h3>● 発話認識</h3>
        <button id="detection-speech-start" v-on:click="startDetectionSpeech">Start</button>
        <button id="detection-speech-end" v-on:click="stopVAD">Stop</button>
      </div>
      <div class="face">
        <h3>● 頷き & 予備動作認識</h3>
        <button id="detection-nod-start" v-on:click="startTracking">Start</button>
        <button id="detection-nod-end" v-on:click="stopTracking">Stop</button>
      </div>
      <video ref="video" id="video" width="500" height="500" autoplay></video>
    </div>
  </div>
</template>

<script>
import vad from 'voice-activity-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs';
import positionArray from "./position.js";
import firebaseConfig from "./firebase.js";
import { initializeApp } from "firebase/app";
import { getFirestore, onSnapshot, collection, query, doc, updateDoc } from 'firebase/firestore';

export default {
  name: 'App',
  components: {},
  data: function() {
    return {
      // speech detection
      vadObject: null,
      context: null,
      speechCount: 0,
      isSpeechCount: false,
      isSpeech: false,
      // nod detection
      faceModel: null,
      video: null,
      detector: null,
      meanNodArray: [],
      nodAverageScore: 0,
      nodCount: 0,
      motivationCount: 0,
      // Flower Array
      flowerImageType: {
        redFlower: require(`@/assets/flower-red.png`),
        blueFlower: require(`@/assets/flower-blue.png`),
        whiteFlower: require(`@/assets/flower-white.png`),
        witheredFlower: require(`@/assets/flower-withered.png`),
        redBud: require(`@/assets/bud-red.png`),
        blueBud: require(`@/assets/bud-blue.png`),
        whiteBud: require(`@/assets/bud-white.png`),
        none: null,
      },
      gardenPadding: 30,
      flowerImage: null,
      flowerPosition: positionArray,
      displayFlowerPostionArray: [],
      beforeRedSpeechMotivation: 0,
      beforeBlueSpeechMotivation: 0,
      beforeWhiteSpeechMotivation: 0,
      faceIntervalTimer: null,
      playerStatusText: "player-1",//"no setting",
      dbConnectionStatusText: "未選択",
      trackingStatusText: "未選択",
      playerSettingButtons: [
        { 
          cmd: 'setPlayer1',
          title: "player-1",
          color: "赤",
        },
        { 
          cmd: 'setPlayer2',
          title: "player-2",
          color: "青",
        },
        { 
          cmd: 'setPlayer3',
          title: "player-3",
          color: "白",
        },
      ],
      firestoreDB: null,
      unsubscribeDB: null,
      countStatus: {
        motivation: 0,
        nod: 0,
        speech: 0
      },
      isDebug: false,
    }
  },
  mounted: function () {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.video = document.querySelector("video");
    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
    }).then(stream => {
        this.video.srcObject = stream;
        this.video.play()
    }).catch(e => {
      console.log(e)
    })

    const app = initializeApp(firebaseConfig);
    this.firestoreDB = getFirestore(app);
    console.log(this.firestoreDB);
  },
  watch: {
    nodCount: function() {
      if (this.isDebug) return; 
      console.log("post");
      this.postCountPlayer();
    },
    speechCount: function() {
      if (this.isDebug) return; 
      this.postCountPlayer();
    },
    motivationCount: function() {
      if (this.isDebug) return; 
      this.postCountPlayer();
    },
  },
  computed: {
    calcSum: function() {
      return this.meanNodArray.reduce(function(sum, element) {
        return sum + element;
      })
    },
    calcAverage: function() {
      return Math.floor(this.calcSum / this.meanNodArray.length);
    }
  },
  methods: {
    displayFlowerImage: function (displayImageType) {
      if(!this.flowerPosition.length) { return }

      // ランダムにindexを算出して，フラワー表示配列から表示するIDを取得
      const randomIndex = Math.floor(Math.random() * this.flowerPosition.length);
      const randomFlowerPosition = this.flowerPosition[randomIndex];

      // flowerPositionIDに紐づくflowerPositionのステータスを変更
      const index = this.flowerPosition.indexOf(randomFlowerPosition);
      this.flowerPosition[index].status = true;
      this.flowerPosition[index].image = displayImageType
      this.setRemoveFlowerTimer(this.flowerPosition[index]);

      // 表示されるflowerPosition表示済配列に格納
      this.displayFlowerPostionArray.push(this.flowerPosition[index]);
      // 表示されるflowerPositionの要素を配列から削除
      this.flowerPosition.splice(index, 1);
    },
    setRemoveFlowerTimer: function (flowerPosition) {
      // 10秒後に枯れ花表示
      setTimeout(() => {
        const index = this.displayFlowerPostionArray.indexOf(flowerPosition);
        this.displayFlowerPostionArray[index].image = this.flowerImageType.witheredFlower;
      }, 30000);

      // 2秒後に枯れ花表示
      setTimeout(() => {
        console.log("remove flower");
        // 表示済配列から花のオブジェクトと一致するindexを取得
        const index = this.displayFlowerPostionArray.indexOf(flowerPosition);
        this.displayFlowerPostionArray[index].status = false;
        this.displayFlowerPostionArray[index].image = this.flowerImageType.none;

        // 非表示にされた花のオブジェクトをフラワー表示配列に格納
        this.flowerPosition.push(this.displayFlowerPostionArray[index]);
        // 表示済配列から非表示にされた花のオブジェクトの要素を削除
        this.displayFlowerPostionArray.splice(index, 1);
      }, 32000);
    },
    startFeedback: async function() {
      if (this.playerStatusText === "no setting") {
        alert("playerを設定してください。");
        return;
      }
      this.dbConnectionStatusText = "開始";

      const q = query(collection(this.firestoreDB, "players"));
      this.unsubscribeDB = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            
            console.log("Modified: ", change.doc.data());
            // DBのカウント数に合わせて花の表示を行う（ランダム表示）
            this.setFlowerCountWithDB(change.doc.id, change.doc.data());
            this.countStatus = change.doc.data(); 
          }
          if (change.type === "modified") {
            console.log("Modified: ", change.doc.data());
            console.log("Player: ", change.doc.id);

            switch(change.doc.id) {
              case 'player-1':
                if (this.beforeRedSpeechMotivation < change.doc.data().motivation) {
                  // speechtとnod または motivationか判断するために変更前のカウントを格納しておく
                  this.beforeRedSpeechMotivation = change.doc.data().motivation;
                  this.setBudTypeWithDB(change.doc.id);
                } else {
                  this.setFlowerTypeWithDB(change.doc.id);
                }
                break
              case 'player-2':
                if (this.beforeBlueSpeechMotivation < change.doc.data().motivation) {
                  this.beforeBlueSpeechMotivation = change.doc.data().motivation;
                  this.setBudTypeWithDB(change.doc.id);
                } else {
                  this.setFlowerTypeWithDB(change.doc.id);
                }
                break
              case 'player-3':
                if (this.beforeWhiteSpeechMotivation < change.doc.data().motivation) {
                  this.beforeWhiteSpeechMotivation = change.doc.data().motivation;
                  this.setBudTypeWithDB(change.doc.id);
                } else {
                  this.setFlowerTypeWithDB(change.doc.id);
                }
                break
            }
          }
          if (change.type === "removed") {
            console.log("Removed: ", change.doc.data());
          }
        });
      });
    },
    startAllTracking: function() {
      this.trackingStatusText = "開始";
      this.startTracking();
      this.startDetectionSpeech();
    },
    stopAllTracking: function() {
      this.trackingStatusText = "終了";
      this.stopTracking();
      this.stopVAD();
    },
    startDebug: function() {
      this.isDebug = !this.isDebug;
    },
    setFlowerCountWithDB: function(playerID, docData) {
      const flowerCount = docData.speech + docData.nod;
      for (let i=0; i<flowerCount; i++) {
        this.setFlowerTypeWithDB(playerID);
      }

      for (let i=0; i<docData.motivation; i++) {
        this.setBudTypeWithDB(playerID);
      }
    },
    stopFeedback: function() {
      console.log("stopFeedback");
      this.dbConnectionStatusText = "終了";
      this.unsubscribeDB();
    },
    setFlowerTypeWithDB: function(playerID) {
      switch(playerID) {
        case 'player-1':
          this.displayFlowerImage(this.flowerImageType.redFlower);
          break
        case 'player-2':
          this.displayFlowerImage(this.flowerImageType.blueFlower);
          break
        case 'player-3':
          this.displayFlowerImage(this.flowerImageType.whiteFlower);
          break
      }
    },
    setBudTypeWithDB: function(playerID) {
      switch(playerID) {
        case 'player-1':
          this.displayFlowerImage(this.flowerImageType.redBud);
          break
        case 'player-2':
          this.displayFlowerImage(this.flowerImageType.blueBud);
          break
        case 'player-3':
          this.displayFlowerImage(this.flowerImageType.whiteBud);
          break
      }
    },
    postCountPlayer: async function() {
      const playersRef = doc(this.firestoreDB, "players", this.playerStatusText)
      await updateDoc(playersRef, {
        motivation: this.countStatus.motivation,
        nod: this.countStatus.nod,
        speech: this.countStatus.speech
      });
    },
    resetCountPlayer: async function() {
      [0, 1, 2].forEach(async (index) => {
        const playersRef = doc(this.firestoreDB, "players", this.playerSettingButtons[index].title);
        await updateDoc(playersRef, {
          motivation: 0,
          nod: 0,
          speech: 0
        });
        console.log("Reset player: ", this.playerSettingButtons[index].title);
      });
    },
    setPlayer(command) {
      switch(command.cmd) {
        case 'setPlayer1':
          this.playerStatusText = "player-1";
          break
        case 'setPlayer2':
          this.playerStatusText = "player-2";
          break
        case 'setPlayer3':
          this.playerStatusText = "player-3";
          break
        default:
          this.playerStatusText = "player-1";
      }
    },
    startTracking: async function() {
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig = {
        runtime: 'mediapipe', // or 'tfjs'
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
      }
      this.detector = await faceLandmarksDetection.createDetector(model, detectorConfig);

      this.faceIntervalTimer = setInterval(async() => {
        const faces = await this.detector.estimateFaces(this.video);

        // MARK: - Nod Recognition

        // 顔の角度計算
        const rad = this.calcFaceRotation(faces);
        console.log("rad_x: ",rad[0],"rad_y: ",rad[1]);
        this.meanNodArray.push(rad[1]);

        console.log("meanNodArray: ", this.meanNodArray);

        // keypoint
        this.outputDebug("nod point", rad[1]);

        // meanNodArrayのサンプル数が10以下の場合、skipする
        if (this.meanNodArray.length < 10) {
          this.nodCount = 0;
          this.nodAverageScore = this.calcAverage;
          console.log("nod count: skip");
        }
        
        if (this.meanNodArray.length >= 10) {
          // 10秒ごとのnodの平均算出
          this.outputDebug("nod average", this.nodAverageScore);
          // 平均の基準よりも下を向いているか
          if (this.nodAverageScore-5 > rad[1]) {
            console.log("****** nod count ******");
            this.nodCount += 1;
            this.countStatus.nod += 1;
            console.log(this.nodCount);
            this.outputDebug("this.countStatus.nod", this.countStatus.nod);
          }
          this.meanNodArray.shift();
        }

        // MARK: - Mouth Recognition
        const topLipPoint = faces[0].keypoints[13].y
        const underLipPoint = faces[0].keypoints[14].y
        const mouseOpened = underLipPoint - topLipPoint
        if (!this.isSpeech && (10 < mouseOpened && mouseOpened < 20)) {
          console.log("top: "+topLipPoint+"under: "+underLipPoint+"\n"+"mouseOpened: "+mouseOpened);
          console.log("****** motivation count ******");
          this.motivationCount += 1;
          this.countStatus.motivation += 1;
          this.outputDebug("this.countStatus.motivation", this.countStatus.motivation);
          return
        }
        console.log("motivation count: skip");
      }, 1000) // 1秒間
    },
    stopTracking: function() {
      this.detector = null;
      clearInterval(this.faceIntervalTimer);
    },
    startDetectionSpeech: function() {
      this.setVAD((val) => {
        console.log(val);
      }, ()=>{
        if (!this.isSpeechCount) {
          this.isSpeechCount = true;
          return;
        }
        console.log("****** speechカウント ******");
        this.speechCount += 1;
        this.countStatus.speech += 1;
        this.outputDebug("this.countStatus.speech", this.countStatus.speech);
      })
    },
    setVAD: function(update, stopHandler) {
      let vadOptions = {
        minCaptureFreq: 100,
        maxCaptureFreq: 300,
        minNoiseLevel: 0.5,
        maxNoiseLevel: 0.5,
        onVoiceStart: function() {
          console.log("Voice Start");
          this.isSpeech = true;
        },
        onVoiceStop: function() {
            console.log("Voice Stop");
            this.isSpeech = false;
            stopHandler();
        },
        onUpdate: function(val) {
            // 音声が検出されると発火
            update(val);
        }
      }
      this.context = new AudioContext()

      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
          this.vadObject = vad(this.context, stream, vadOptions);
        })
      }
    },
    stopVAD: function() {
      console.log("VadObject Destroy");
      this.vadObject.destroy();
      this.vadObject = null;
    },
    outputDebug: function(message, value) {
      if(message === null) { message = "" }
      if(value === null) { value = "" }

      console.log("【Debug】: "+message+" - "+value);
    },
    calcFaceRotation: function(faces) {
      let faceOvalArray = [];

      faces[0].keypoints.forEach((keypoint) => {
        if (keypoint.name == undefined) return
        if (keypoint.name == 'faceOval') {
          faceOvalArray.push([keypoint.x, keypoint.y, keypoint.z]);
        }
      });

      // tfの配列格納
      let faceMulciArray = tf.tensor(faceOvalArray);

      // 目の算出
      const rightEye = tf.tensor1d([
        faces[0].keypoints[33].x, faces[0].keypoints[33].y, faces[0].keypoints[33].z
      ]);
      const leftEye = tf.tensor1d([
        faces[0].keypoints[263].x, faces[0].keypoints[263].y, faces[0].keypoints[263].z
      ]);

      // 顔点群の正規化
      const faceNorm = faceMulciArray.div(tf.norm(rightEye.sub(leftEye)).mul(0.06));
      const centerPosition = faceNorm.sub(faceNorm.mean(0));

      const c00 = centerPosition.slice(0, 1).as1D();
      const c09 = centerPosition.slice(9, 1).as1D();
      const c18 = centerPosition.slice(18, 1).as1D();
      const c27 = centerPosition.slice(27, 1).as1D();

      // 回転行列
      const rotate0 = c18.sub(c00).div(tf.norm(c18.sub(c00))); // 顔の垂直方向
      const rotate1 = c09.sub(c27).div(tf.norm(c09.sub(c27))); // 顔の水平方向

      // tfに変換
      let rotate = tf.concat([rotate0, rotate1]).arraySync();

      // y座標のベクトル
      const m00 = rotate[0];
      const m01 = rotate[1];
      const m02 = rotate[2];

      // x座標のベクトル
      const m10 = rotate[3];
      const m11 = rotate[4];
      const m12 = rotate[5];

      // 外積より法線ベクトルを求める
      const m20 = m01 * m12 - m02 * m11;
      const m21 = m02 * m10 - m00 * m12;
      const m22 = m00 * m11 - m01 * m10;

      const sy = Math.sqrt(m00 * m00 + m10 * m10);
      const X = (Math.atan2(m21, m22) * 180) / Math.PI;
      const Y = (Math.atan2(-m20, sy) * 180) / Math.PI;
      const Z = (Math.atan2(m10, m00) * 180) / Math.PI;

      let radX = 0;
      let radY = 0;

      //Y軸のマイナス値の変更
      if (X < 0) {
        radY = Math.floor(X) + 360;
      } else {
        radY = X;
      }

      if (radY < 100) {
        radY += 300;
      }

      radX = Math.floor(Y) + 45;

      return [radX, radY, Z];
    }
  }
}
</script>

<style>
button {
  font-size: 1.5rem;
  font-weight: 500;
  position: relative;
  display: inline-block;
  padding: 1rem 1.3rem;
  cursor: pointer;
  -webkit-transition: all 0.3s;
  transition: all 0.3s;
  text-align: center;
  letter-spacing: 0.1em;
  border-radius: 0.5rem;
  color: #fff;
  background: #f56500;
  border: 1px solid #ccc;
  margin: 10px;
}

.debug-setting-block {
  padding-top: 500px;
}

</style>
