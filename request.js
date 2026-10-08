"use strict";

// Set the deployed HTTPS Worker /request URL before publishing this page.
const REQUEST_ENDPOINT = "https://hs2trainer-runtime.ero--iege.workers.dev/request";
const DEVICE_PATTERN = /^HS1-[0-9A-F]{64}$/;

function prepareRequest({email, name = "", deviceCode, tier}) {
  deviceCode = deviceCode.trim().toUpperCase();
  email = email.trim();
  name = name.trim() || "Friend PC";
  if (!DEVICE_PATTERN.test(deviceCode)) throw new Error("Copy the complete device code from the loader: HS1- followed by 64 hexadecimal characters.");
  const tiers = {eac: 0, lite: 1, full: 2};
  if (!Object.hasOwn(tiers, tier)) throw new Error("Choose a valid license tier.");
  if (email.length > 254 || !/^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/.test(email)) throw new Error("Enter a valid reply email address.");
  if (name.length > 80 || /[\r\n\x00-\x1f\x7f]/.test(name)) throw new Error("Use a name of up to 80 characters on one line.");
  return {email, name, deviceCode, tier: tiers[tier]};
}

if (typeof document !== "undefined") {
  const form = document.getElementById("request-form");
  const device = document.getElementById("device");
  const status = document.getElementById("status");
  const button = document.getElementById("send-request");
  let pending = false;
  if (REQUEST_ENDPOINT) button.disabled = false;
  else status.textContent = "License requests are being set up. Check back shortly.";

  const suppliedDevice = new URLSearchParams(window.location.search).get("device");
  if (suppliedDevice && DEVICE_PATTERN.test(suppliedDevice.trim().toUpperCase())) device.value = suppliedDevice.trim().toUpperCase();
  // Avoid leaving a device identifier in copied page links or later referrers.
  if (suppliedDevice !== null) window.history.replaceState(null, "", window.location.pathname + window.location.hash);

  form.addEventListener("input", () => {
    if (!pending && REQUEST_ENDPOINT) { button.disabled = false; status.textContent = ""; }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (pending || !REQUEST_ENDPOINT) return;
    let request;
    try {
      request = prepareRequest({deviceCode: device.value, tier: document.getElementById("tier").value, name: document.getElementById("name").value, email: document.getElementById("email").value});
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.message;
      return;
    }
    device.value = request.deviceCode;
    pending = true;
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.classList.remove("error");
    status.textContent = "Sending your request…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(REQUEST_ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request), credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal});
      if (!response.ok) {
        if (response.status === 429) throw new Error("Too many requests. Please wait and try again later.");
        if (response.status === 400 || response.status === 422) throw new Error("Check your device code, reply email, and tier, then try again.");
        throw new Error("The request service is unavailable. Please try again later.");
      }
      status.textContent = "Request received. Your license file will be sent to your reply email after it is approved.";
    } catch (error) {
      status.classList.add("error");
      status.textContent = error.name === "AbortError" || error instanceof TypeError ? "Could not reach the request service. Please try again later." : error.message;
      button.disabled = false;
    } finally {
      clearTimeout(timeout);
      pending = false;
      form.removeAttribute("aria-busy");
    }
  });
}

if (typeof module !== "undefined") module.exports = {prepareRequest};
