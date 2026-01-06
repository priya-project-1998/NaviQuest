const ENV = {
  dev: {
    BASE_URL: "http://trail-hunt.randomsoftsolution.in:8000/api",
    CONTENT_TYPE: "application/json",
    ACCEPT: "application/json",
  },
  qa: {
    BASE_URL: "http://qa-api.demo.com/api",
    CONTENT_TYPE: "application/json",
    ACCEPT: "application/json",
  },
  prod: {
    BASE_URL: "http://trail-hunt.randomsoftsolution.in:8000/api",
    CONTENT_TYPE: "application/json",
    ACCEPT: "application/json",
  },
};

const CURRENT_ENV = "prod"; // change this to "qa" or "prod" when needed
const Config = { ...ENV[CURRENT_ENV], ENV_NAME: CURRENT_ENV };

export default Config;
