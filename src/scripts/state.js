const baseStatus = {
  assetSummary: "idle",
  exchangesSummary: "idle",
  alerts: "idle",
  topAutotraders: "idle",
  tradeHistory: "idle",
};

let state = {
  data: {
    assetSummary: null,
    exchangesSummary: null,
    alerts: null,
    topAutotraders: [],
    tradeHistory: [],
  },
  status: { ...baseStatus },
  errors: {
    assetSummary: null,
    exchangesSummary: null,
    alerts: null,
    topAutotraders: null,
    tradeHistory: null,
  },
};

const subscribers = new Set();

export const getState = () => state;

export const setState = (partial) => {
  state = {
    ...state,
    ...partial,
    data: {
      ...state.data,
      ...(partial.data || {}),
    },
    status: {
      ...state.status,
      ...(partial.status || {}),
    },
    errors: {
      ...state.errors,
      ...(partial.errors || {}),
    },
  };
  subscribers.forEach((callback) => callback(state));
};

export const subscribe = (callback) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

export const setSectionStatus = (section, status, error = null) => {
  setState({
    status: { [section]: status },
    errors: { [section]: error },
  });
};

export const resetState = () => {
  state = {
    data: {
      assetSummary: null,
      exchangesSummary: null,
      alerts: null,
      topAutotraders: [],
      tradeHistory: [],
    },
    status: { ...baseStatus },
    errors: {
      assetSummary: null,
      exchangesSummary: null,
      alerts: null,
      topAutotraders: null,
      tradeHistory: null,
    },
  };
};
