<template>
  <Bar
    :chart-options="chartOptions"
    :chart-data="chartData"
    :chart-id="chartId"
    :dataset-id-key="datasetIdKey"
    :plugins="plugins"
    :css-classes="cssClasses"
    :styles="styles"
    :width="width"
    :height="height"
  />
</template>

<script>
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

export default {
  name: 'BarChart',
  components: { Bar },
  props: {
    chartId: {
      type: String,
      default: 'bar-chart'
    },
    datasetIdKey: {
      type: String,
      default: 'label'
    },
    width: {
      type: Number,
      default: 100
    },
    height: {
      type: Number,
      default: 100
    },
    cssClasses: {
      default: '',
      type: String
    },
    styles: {
      type: Object,
      default: () => {}
    },
    plugins: {
      type: Array,
      default: () => []
    },
    // datasets: {
    //   type: Array,
    //   default: {
    //     label: 'Data One',
    //     backgroundColor: '#f87979',
    //     data: [30, 20, 12]
    //   }
    // },
  },
  data() {
    return {
      chartData: {
        labels: [ '発話回数', '頷き回数', '予備動作回数' ],
        datasets: [ 
          { 
            label: 'Data One',
            backgroundColor: '#f87979',
            data: [30, 20, 12]
          }
        ]
      },
      chartOptions: {
        responsive: false,
        maintainAspectRatio: false
      }
    }
  }
}
</script>