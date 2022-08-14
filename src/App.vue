<template>
  <div id="app">
    <div class="gardening">
      <h2>■ フィードバック</h2>
      <div class="bed-block">
        <img id="bed" :src="require(`@/assets/flower-bed.png`)" width="600" :style="{position:`relative`}">
        <div class="flower" v-for="(item, index) in flowerRedPositionArray" :key="index">
          <!-- X：70-450, Y：50-250 -->
          <img
            id="flower-red"
            width="30"
            :src="require(`@/assets/flower-red.png`)"
            :style="{position: 'absolute', top: `${position_flower_y+item.y}px`, left: `${position_flower_x+item.x}px` }"
          >
        </div>
        <div class="flower" v-for="(item, index) in flowerBluePositionArray" :key="index">
          <img
            id="flower-blue"
            width="30"
            :src="require(`@/assets/flower-blue.png`)"
            :style="{position: 'absolute', top: `${position_flower_y+200-item.y}px`, left: `${position_flower_x+350-item.x}px` }"
          >
        </div>
        <div class="flower" v-for="(item, index) in flowerWhitePositionArray" :key="index">
          <img
            id="flower-white"
            width="30"
            :src="require(`@/assets/flower-white.png`)"
            :style="{position: 'absolute', top: `${position_flower_y+200-item.y}px`, left: `${position_flower_x+350-item.x}px` }"
          >
        </div>
        <div class="bud-block">
          <div class="flower" v-for="(item, index) in budRedPositionArray" :key="index">
            <img
              id="bud-white"
              width="20"
              :src="require(`@/assets/bud-red.png`)"
              :style="{position: 'absolute', top: `${position_flower_y+item.y}px`, left: `${position_flower_x+item.x}px` }"
            >
          </div>
          <div class="flower" v-for="(item, index) in budBluePositionArray" :key="index">
            <img
              id="bud-white"
              width="20"
              :src="require(`@/assets/bud-blue.png`)"
              :style="{position: 'absolute', top: `${position_flower_y+item.y}px`, left: `${position_flower_x+item.x}px` }"
            >
          </div>
          <div class="flower" v-for="(item, index) in budWhitePositionArray" :key="index">
            <img
              id="bud-white"
              width="20"
              :src="require(`@/assets/bud-white.png`)"
              :style="{position: 'absolute', top: `${position_flower_y+item.y}px`, left: `${position_flower_x+item.x}px` }"
            >
          </div>
        </div>
        <div class="player-status"><h3>1. プレイヤー設定：{{ playerStatusText }}</h3></div>
        <button
          v-for="btn in playerSettingButtons" 
          :key="btn.id"
          @click="btnClicked(btn)">{{btn.title}}:{{ btn.color }}
        </button>
        <div class="feedback-controll">
          <h3>2. DB接続</h3>
          <button class="test-start-button" v-on:click="startFeedback">Start</button>
          <button class="test-stop-button" v-on:click="stopFeedback">Stop</button>
        </div>
        <div class="tracking-controll">
          <h3>3. 会話行動検知</h3>
          <button class="test-start-button" v-on:click="startFeedback">Start</button>
          <button class="test-stop-button" v-on:click="stopFeedback">Stop</button>
        </div>
      </div>
    </div>
    <div class="setting-recognition">
      <h2>■ デバッグ</h2>
      <div class="count-all">
        <li>発話回数   ：{{ speechCount }}</li>
        <li>頷き回数   ：{{ nodCount }}</li>
        <li>予備動作回数：{{ motivationCount }}</li>
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
import firebaseConfig from "./firebase.js"
import { initializeApp } from "firebase/app";
import { getFirestore, onSnapshot, collection, query, doc, updateDoc } from 'firebase/firestore';

export default {
  name: 'App',
  components: {
  },
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
      meanPose: [],
      nodAverageScore: 0,
      nodCount: 0,
      position_flower_x: 70,
      position_flower_y: 50,
      motivationCount: 0,
      // Flower Array
      flowerRedPositionArray: [],
      flowerBluePositionArray: [],
      flowerWhitePositionArray: [],
      // Bud Array
      budRedPositionArray: [],
      budBluePositionArray: [],
      budWhitePositionArray: [],
      beforeRedSpeechMotivation: 0,
      beforeBlueSpeechMotivation: 0,
      beforeWhiteSpeechMotivation: 0,
      faceIntervalTimer: null,
      playerStatusText: "player-1",//"no setting",
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
      }
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

    // this.startTracking();
  },
  watch: {
    nodCount: function() {
      // this.countMeetingInfo();
      this.postCountPlayer();
    },
    speechCount: function() {
      // this.countMeetingInfo();
      this.postCountPlayer();
    },
    motivationCount: function() {
      this.postCountPlayer();
    },
  },
  computed: {
    calcSum: function() {
      return this.meanPose.reduce(function(sum, element) {
        return sum + element;
      })
    },
    calcAverage: function() {
      return this.calcSum / this.meanPose.length;
    }
  },
  methods: {
    startFeedback: async function() {
      if (this.playerStatusText === "no setting") {
        alert("playerを設定してください。");
        return;
      }

      // 後ほどmounted
      const app = initializeApp(firebaseConfig);
      this.firestoreDB = getFirestore(app);
      console.log(this.firestoreDB);

      const q = query(collection(this.firestoreDB, "players"));
      this.unsubscribeDB = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            console.log("New Add: ", change.doc.data());
            this.setFlowerOfPlayer(change.doc.id, change.doc.data());
            this.countStatus = change.doc.data(); 
          }
          if (change.type === "modified") {
            console.log("Modified: ", change.doc.data());
            console.log("Player: ", change.doc.id);

            switch(change.doc.id) {
              case 'player-1':
                if (this.beforeRedSpeechMotivation < change.doc.data().motivation) {
                  this.pushBudOfPlayer(change.doc.id, change.doc.data().motivation);
                } else {
                  this.pushFlowerOfPlayer(change.doc.id);
                }
                break
              case 'player-2':
                if (this.beforeBlueSpeechMotivation < change.doc.data().motivation) {
                  this.pushBudOfPlayer(change.doc.id, change.doc.data().motivation);
                } else {
                  this.pushFlowerOfPlayer(change.doc.id);
                }
                break
              case 'player-3':
                if (this.beforeWhiteSpeechMotivation < change.doc.data().motivation) {
                  this.pushBudOfPlayer(change.doc.id, change.doc.data().motivation);
                } else {
                  this.pushFlowerOfPlayer(change.doc.id);
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
      this.startTracking();
      this.startDetectionSpeech();
    },
    stopAllTracking: function() {
      this.stopFeedback();
      this.stopVAD();
    },
    setFlowerOfPlayer: function(playerID, docData) {
      const flowerCount = docData.speech + docData.nod;
      for (let i=0; i<flowerCount; i++) {
        this.pushFlowerOfPlayer(playerID);
      }

      for (let i=0; i<docData.motivation; i++) {
        this.pushBudOfPlayer(playerID);
      }
    },
    pushFlowerOfPlayer: function(playerID) {
      switch(playerID) {
        case 'player-1':
          this.flowerRedPositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
          break
        case 'player-2':
          this.flowerBluePositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
          break
        case 'player-3':
          this.flowerWhitePositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
          break
      }
    },
    pushBudOfPlayer: function(playerID, motivation) {
      switch(playerID) {
        case 'player-1':
          this.beforeRedSpeechMotivation = motivation;
          this.budRedPositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
          break
        case 'player-2':
          this.beforeBlueSpeechMotivation = motivation;
          this.budBluePositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
          break
        case 'player-3':
          this.beforeWhiteSpeechMotivation = motivation;
          this.budWhitePositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
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
      });
    },
    stopFeedback: function() {
      this.unsubscribeDB();
    },
    setPlayer: function(num) {
      this.playerStatusText = "player-" + num;
    },
    btnClicked(command) {
      switch(command.cmd) {
        case 'setPlayer1':
          this.setPlayer(1);
          break
        case 'setPlayer2':
          this.setPlayer(2);
          break
        case 'setPlayer3':
          this.setPlayer(3);
          break
        default:
          this.setPlayer(1);
      }
    },
    countMeetingInfo: function() {
      this.flowerRedPositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
      // this.budRedPositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
    },
    getRandom: function(min, max) {
      min = Math.ceil(min);
      max = Math.floor(max);
      const result = Math.floor(Math.random() * (max - min + 1) + min);
      return result
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
        this.meanPose.push(faces[0].keypoints[1].y);
        // keypoint
        console.log(faces[0].keypoints[1].y);

        // meanPoseが空の場合、skipする
        if (this.meanPose.length < 10) {
          this.nodCount = 0;
          this.nodAverageScore = this.calcAverage;
          console.log("nod count: skippppppp");
          return
        }

        console.log("nod: average" + this.nodAverageScore);
        // 平均の基準よりも下を向いているか
        if (this.nodAverageScore + 30 < faces[0].keypoints[1].y) {
          console.log("nodカウント！！！！！！！！！！！！！！");
          this.nodCount += 1;
          this.countStatus.nod += 1;
          console.log(this.nodCount);
        }

        const topLipPoint = faces[0].keypoints[13].y
        const underLipPoint = faces[0].keypoints[14].y
        const mouseOpened = underLipPoint - topLipPoint
        if (!this.isSpeech && (10 < mouseOpened && mouseOpened < 20)) {
          console.log("top: "+topLipPoint+"under: "+underLipPoint+"\n"+"mouseOpened: "+mouseOpened);
          console.log("motivationカウント！！！！！！！！！！！！！！");
          this.motivationCount += 1;
          this.countStatus.motivation += 1;
          return
        }
        console.log("motivation count: skippppppp");
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
        console.log("speechカウント！！！！！！！！！！！！！！");
        this.speechCount += 1;
        this.countStatus.speech += 1;
        console.log("this.countStatus.speech: "+this.countStatus.speech);
      })
    },
    setVAD: function(update, stopHandler) {
      let vadOptions = {
        onVoiceStart: function() {
            console.log('voice start');
            this.isSpeech = true;
        },
        onVoiceStop: function() {
            console.log('voice stop');
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
      console.log("vadObject destroy");
      this.vadObject.destroy();
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

.bed-block {
  position: relative;
  margin-bottom: 500px;
}

.flower-block {
  position: absolute;
}
</style>
