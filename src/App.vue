<template>
  <div id="app">
    <div class="gardening">
      <h2>■ フィードバック</h2>
      <div class="bed-block">
        <img id="bed" :src="require(`@/assets/flower-bed.png`)" width="600" :style="{position:`relative`}">
        <div class="flower" v-for="(item, index) in flowerPositionArray" :key="index">
          <!-- X：70-450, Y：50-250 -->
          <img
            id="flower"
            :src="require(`@/assets/flower-red.png`)"
            :style="{position: 'absolute', top: `${position_flower_y+item.y}px`, left: `${position_flower_x+item.x}px` }"
          >
          <img
            id="flower-2"
            v-if="index % 3 === 1"
            :src="require(`@/assets/flower-blue.png`)"
            :style="{position: 'absolute', top: `${position_flower_y+200-item.y}px`, left: `${position_flower_x+350-item.x}px` }"
          >
        <div class="flower" v-for="(item, index) in budPositionArray" :key="index">
          <img
            id="bud-white"
            v-if="index % 5 === 1"
            :src="require(`@/assets/bud-white.png`)"
            :style="{position: 'absolute', top: `${position_flower_y+item.y}px`, left: `${position_flower_x+item.x}px` }"
          >
        </div>
        </div>
        <div class="count-all">
          <li>発話回数   ：{{ speechCount }}</li>
          <li>頷き回数   ：{{ nodCount }}</li>
          <li>予備動作回数：0</li>
        </div>
      </div>
    </div>
    <div class="speech" v-bind="speechCount">
      <h2>■ 発話認識</h2>
      <div class="count-label">{{ speechCount }}回</div>
      <button id="detection-speech-start" v-on:click="startDetectionSpeech">start</button>
      <button id="detection-speech-end" v-on:click="stopVAD">stop</button>
    </div>
    <div class="face">
      <h2>■ 頷き認識</h2>
      <div class="count-label">{{ nodCount }}回</div>
      <button id="detection-nod-start" v-on:click="startTracking">start</button>
      <button id="detection-nod-end" v-on:click="stopTracking">stop</button>
    </div>
    <video ref="video" id="video" width="500" height="500" autoplay></video>
  </div>
</template>

<script>
import vad from 'voice-activity-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'

export default {
  name: 'App',
  components: {
  },
  data: function() {
    return {
      vadObject: null,
      context: null,
      speechCount: 0,
      isSpeechCount: false,
      faceModel: null,
      video: null,
      detector: null,
      meanPose: [],
      nodAverageScore: 0,
      nodCount: 0,
      position_flower_x: 70,
      position_flower_y: 50,
      flowerPositionArray: [],
      budPositionArray: [],
      faceIntervalTimer: null,
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

    this.startTracking();
  },
  watch: {
    nodCount: function() {
      this.countMeetingInfo();
    },
    speechCount: function() {
      this.countMeetingInfo();
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
    countMeetingInfo: function() {
      this.flowerPositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
      this.budPositionArray.push({x: this.getRandom(0, 350), y: this.getRandom(0, 210)});
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
          console.log("skippppppp");
          return
        }

        console.log("nod: average" + this.nodAverageScore);
        // 平均の基準よりも下を向いているか
        if (this.nodAverageScore + 30 < faces[0].keypoints[1].y) {
          console.log("nodカウント！！！！！！！！！！！！！！");
          this.nodCount += 1;
          console.log(this.nodCount);
        }
      }, 1000) // 1秒間
      this.startDetectionSpeech();
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
      })
    },
    setVAD: function(update, stopHandler) {
      let vadOptions = {
        onVoiceStart: function() {
            console.log('voice start');
        },
        onVoiceStop: function() {
            console.log('voice stop');
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
      if(this.vadObject) {
        // 音声検出を終了する
        this.vadObject.destroy();
      }
   }
  }
}
</script>

<style>
button {
  font-size: 1.6rem;
  font-weight: 500;
  position: relative;
  display: inline-block;
  padding: 1rem 3rem;
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
