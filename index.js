// 필요한 모듈을 import 합니다.
const Binance = require('binance-api-node').default;
const WebSocket = require('ws');
const blessed = require('blessed');

// API 키 및 시크릿키를 선언합니다.
const apiKey = 'your-api-key';
const apiSecret = 'your-api-secret';

// TradingBot의 상태를 표시할 텍스트 박스를 생성합니다.
const statusBox = blessed.box({
  top: 'center',
  left: 'center',
  width: '50%',
  height: '50%',
  content: '',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    border: {
      fg: '#f0f0f0'
    }
  }
});

// Dashboard에 텍스트 박스를 추가합니다.
dashboard.append(statusBox);

// TradingBot의 상태를 업데이트하는 함수입니다.
function updateStatus(status) {
  statusBox.setContent(status);
  dashboard.render();
}

// 현재 금액과 수익률을 표시할 텍스트 박스를 생성합니다.
const balanceBox = blessed.box({
  top: '50%',
  left: 'center',
  width: '50%',
  height: '50%',
  content: '',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    border: {
      fg: '#f0f0f0'
    }
  }
});

// Dashboard에 텍스트 박스를 추가합니다.
dashboard.append(balanceBox);

// 초기 투입금을 가져오는 함수입니다.
async function getInitialBalance() {
    const accountInfo = await client.futuresAccount();
  
    // 보유 중인 모든 자산의 총 가치를 계산합니다.
    const balance = accountInfo.balances.reduce((sum, asset) => {
      if (asset.asset !== 'USDT' && parseFloat(asset.walletBalance) > 0) {
        const symbol = `${asset.asset}USDT`;
        const ticker = client.futuresTicker(symbol);
        const price = parseFloat(ticker.lastPrice);
        sum += parseFloat(asset.walletBalance) * price;
      } else if (asset.asset === 'USDT') {
        sum += parseFloat(asset.walletBalance);
      }
      return sum;
    }, 0);
  
    return balance;
  }

// 현재 금액과 수익률을 업데이트하는 함수입니다.
async function updateBalance() {
  const positionRisk = await client.futures.positionRisk('BTCUSDT');

  // 현재 금액을 계산합니다.
  const currentBalance = parseFloat(positionRisk[0].marginBalance);

  // 수익률을 계산합니다.
  const profit = ((currentBalance - initialBalance) / initialBalance) * 100;

  // 현재 금액과 수익률을 표시합니다.
  const content = `Current Balance: ${currentBalance}\nProfit: ${profit}%\n`;
  balanceBox.setContent(content);
  dashboard.render();
}

// Binance Futures API와 WebSocket에 접속하기 위한 client를 생성합니다.
const client = Binance({
  apiKey: apiKey,
  apiSecret: apiSecret,
  futures: true
});

const ws = new WebSocket('wss://fstream.binance.com/ws');

// 차트 데이터 배열을 선언합니다.
const candles = [];

// WebSocket으로 실시간으로 받아온 데이터를 차트 데이터 배열에 추가하는 함수입니다.
function subscribeToCandlestick(symbol, interval) {
  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;

  ws.send(
    JSON.stringify({
      method: 'SUBSCRIBE',
      params: [streamName],
      id: 1
    })
  );

  ws.on('message', (data) => {
    const parsedData = JSON.parse(data);

    // WebSocket으로 받아온 데이터를 차트 데이터 배열에 추가합니다.
    const candleData = parsedData.k;
    candles.push({
      time: candleData.t,
      open: parseFloat(candleData.o),
      high: parseFloat(candleData.h),
      low: parseFloat(candleData.l),
      close: parseFloat(candleData.c),
      volume: parseFloat(candleData.v),
      trades: parseInt(candleData.n)
    });

    // 최대 길이를 50으로 제한합니다.
    if (candles.length > 50) {
        candles.shift();
      }
  });
}


// RSI 거래 전략을 구현한 TradingBot 로직입니다.
async function tradingBotLogic() {
  // 지난 14개의 캔들 데이터를 추출합니다.
  const closePrices = candles.slice(-14).map((candle) => parseFloat(candle.close));

  // RSI 값을 계산합니다.
  const rsi = talib.RSI(closePrices, 14)[13];

  // TradingBot의 상태를 업데이트합니다.
  const status = `RSI: ${rsi}\n`;
  updateStatus(status);

  // RSI 값에 따라 매수/매도 시그널을 결정합니다.
  if (rsi < 30) {
    // RSI 값이 30 이하인 경우 매수합니다.
    console.log('Buy signal detected! Placing order...');
    const order = await client.futures.marketBuy('BTCUSDT', 0.01);
    console.log('Order executed:', order);

    // TradingBot의 상태를 업데이트합니다.
    const status = `RSI: ${rsi}\nBuy signal detected! Order executed: ${order.orderId}\n`;
    updateStatus(status);
  } else if (rsi > 70) {
    // RSI 값이 70 이상인 경우 매도합니다.
    console.log('Sell signal detected! Placing order...');
    const order = await client.futures.marketSell('BTCUSDT', 0.01);
    console.log('Order executed:', order);

    // TradingBot의 상태를 업데이트합니다.
    const status = `RSI: ${rsi}\nSell signal detected! Order executed: ${order.orderId}\n`;
    updateStatus(status);
  }
}

const initialBalance = await getInitialBalance();

// TradingBot을 실행하는 함수입니다.
function runTradingBot() {
  // WebSocket을 통해 실시간으로 차트 데이터를 받아옵니다.
  subscribeToCandlestick('BTCUSDT', '1m');
  // 일정 시간 간격으로 TradingBot 로직을 실행합니다.
  setInterval(async () => {
    await tradingBotLogic();
    await updateBalance();
  }, 10000);
}

// TradingBot을 실행합니다.
runTradingBot();