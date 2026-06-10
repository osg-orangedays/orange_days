window.ORANGE_DAYS_CONFIG = {
  eventName: 'Orange Days 2026',
  refreshSeconds: 60, // Intervallo di tempo prima di ogni refresh
  tournaments: [
    {
      id: 'calcio-over35',
      name: 'Calcio Over 35',
      sport: 'Calcio',
      color: '#F97316',
      visible: true,
      points:{
        win: 3,
        draw: 1,
        loss: 0
      },
      phases: [
        {
          id: 'calcio-over35',
          name: 'Finali',
          type: 'finals',
          csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=658226381&single=true&output=csv'
        }
      ]
    },
    {
      id: 'calcio-12h',
      name: 'Calcio a 7 12H',
      sport: 'Calcio',
      color: '#F97316',
      visible: true,
      points:{
        win: 3,
        draw: 1,
        loss: 0
      },
      phases: [
        {
          id: 'Calcio-12H-Gironi',
          name: 'Gironi',
          type: 'groups',
          csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=1238451765&single=true&output=csv'
        },
        {
          id: 'Calcio-12H-Finali',
          name: 'Finali',
          type: 'finals',
          csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=1897489443&single=true&output=csv'
        }
      ],
      scorersCsv: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=31356137&single=true&output=csv"
    },
    {
      id: 'basket-3x3',
      name: 'Basket 3vs3',
      sport: 'Basket',
      color: '#1E3A8A',
      visible: true,
      points:{
        win: 2,
        loss: 0
      },
      phases: [
        {
          id: 'Basket-Gironi',
          name: 'Gironi',
          type: 'groups',
          csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=1096959986&single=true&output=csv'
        },
        {
          id: 'Basket-Finali',
          name: 'Finali',
          type: 'finals',
          csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=1924510662&single=true&output=csv'
        }
      ]
    },
    {
      id: 'green-volley',
      name: 'Green Volley',
      sport: 'Volley',
      color: '#15803D',
      visible: true,
      points:{
        win: 2,
        loss: 0
      },
      phases: [
        {
          id: 'Volley-Gironi',
          name: 'Gironi',
          type: 'groups',
          csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=761051022&single=true&output=csv'
        },
        {
          id: 'Volley-GoldSilver',
          name: 'Silver/Gold',
          type: 'groups',
          csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=1529154982&single=true&output=csv'
        },
        {
          id: 'Volley-Finali',
          name: 'Finali',
          type: 'finals',
          csv: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsPNDmKgGp38qQEdYTPGy6uju4nNJLYGMepeTtd-Qrz7TeY8p23gJz1-I4wB8Aow/pub?gid=1529154982&single=true&output=csv'
        }
      ]
    }
  ]
};
