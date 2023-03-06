function getPayload(text: String) {
  return text.substr(text.indexOf(" ") + 1);
}

export default getPayload;
