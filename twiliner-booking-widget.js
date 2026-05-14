(function () {
  function initTwilinerBookingWidget() {
    const widget = document.querySelector('[data-booking-widget="true"]');
    if (!widget) return;

/**
 * Twiliner Booking Widget
 * 1. DOM Attribute
 * 2. Passagier Stepper
 * 3. Toggle Hin & Zurück
 * 4. Abfahrtsorte aus API
 * 5. Ankunftsorte aus API
 * 6. Kalender Hinfahrt
 * 7. Kalender Rückfahrt
 * 8. Validierung Button
 * 9. Turnit Link
 * 10. URL Parameter & Fallback
* v22: Persistent No Bookable Dates Message Add-on */

    const CONFIG = {
      apiBaseUrl: "https://data.nightride.com/api",
      bookingBaseUrl: "https://booking.twiliner.com/",
      operatorId: "a0cf1341-a01b-449d-b91f-17a1b4f84c44",
      currency: "CHF",
      minPassengers: 1,
      maxPassengers: 9,
      panelTransitionMs: 300,
      apiTimeoutMs: 10000,
      selectedTextColor: "#46288c",
      trackingStorageKey: "twiliner_booking_url_params",
      openInNewTab: false
    };

    const TEXT = {
      de: {
        choose: "Bitte wählen",
        chooseDate: "Datum",
        loading: "Wird geladen...",
        noDepartures: "Keine Abfahrtsorte verfügbar",
        noDestinations: "Keine Ankunftsorte verfügbar",
        noDates: "Keine verfügbaren Reisedaten.",
        noBookableDates: "Für diese Verbindung sind aktuell keine Reisedaten verfügbar.",
        selectOriginFirst: "Bitte wähle einen Abfahrtsort.",
        selectDestinationFirst: "Bitte wähle einen Ankunftsort.",
        selectRouteFirst: "Bitte wähle zuerst Abfahrtsort und Ankunftsort.",
        selectDepartureFirst: "Bitte wähle ein Datum für die Hinfahrt.",
        originApiError: "Die Abfahrtsorte konnten nicht geladen werden.",
        destinationApiError: "Die Ankunftsorte konnten nicht geladen werden.",
        datesApiError: "Die Reisedaten konnten nicht geladen werden.",
        fallbackMessage: "Das Buchungswidget ist momentan nicht verfügbar. Bitte nutze direkt das Buchungstool.",
        bookingLinkError: "Der Buchungslink konnte nicht erstellt werden.",
        directBooking: "Direkt im Buchungstool buchen",
        months: [
          "Januar",
          "Februar",
          "März",
          "April",
          "Mai",
          "Juni",
          "Juli",
          "August",
          "September",
          "Oktober",
          "November",
          "Dezember"
        ],
        monthsShort: [
          "Jan",
          "Feb",
          "Mär",
          "Apr",
          "Mai",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Okt",
          "Nov",
          "Dez"
        ],
        weekdays: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
      },
      en: {
        choose: "Please select",
        chooseDate: "Date",
        loading: "Loading...",
        noDepartures: "No departure places available",
        noDestinations: "No arrival places available",
        noDates: "No available travel dates.",
        noBookableDates: "There are currently no travel dates available for this connection.",
        selectOriginFirst: "Please select a departure place.",
        selectDestinationFirst: "Please select an arrival place.",
        selectRouteFirst: "Please select departure and arrival first.",
        selectDepartureFirst: "Please select a date for the outbound trip.",
        originApiError: "Departure places could not be loaded.",
        destinationApiError: "Arrival places could not be loaded.",
        datesApiError: "Travel dates could not be loaded.",
        fallbackMessage: "The booking widget is currently unavailable. Please use the booking tool directly.",
        bookingLinkError: "The booking link could not be created.",
        directBooking: "Open booking tool directly",
        months: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December"
        ],
        monthsShort: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec"
        ],
        weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
      }
    };

    const API_LANGUAGE_MAP = {
      de: "de",
      en: "en"
    };

    const LEGACY_CITY_CODE_MAP = {
      zurich: "001",
      zuerich: "001",
      zurigo: "001",

      bern: "002",
      berne: "002",

      basel: "012",

      girona: "004",
      barcelona: "005",
      amsterdam: "006",
      rotterdam: "008",

      brussels: "009",
      brussel: "009",
      bruxelles: "009",

      luxembourg: "010",
      luxemburg: "010"
    };

    const TURNIT_CITY_NAME_BY_LEGACY_CODE = {
      "001": "Zurich",
      "002": "Bern",
      "012": "Basel",
      "004": "Girona",
      "005": "Barcelona",
      "006": "Amsterdam",
      "008": "Rotterdam",
      "009": "Brussels",
      "010": "Luxembourg"
    };

    const TURNIT_PROTECTED_PARAMS = new Set([
      "origin",
      "destination",
      "departureDate",
      "returnDate",
      "passengers",
      "productType",
      "language"
    ]);

    const state = {
      language: getCurrentLanguage(),
      tripType: "roundtrip",
      passengers: 1,

      selectedOrigin: null,
      selectedDestination: null,
      selectedDepartureDate: null,
      selectedReturnDate: null,

      originPlaces: [],
      destinationPlaces: [],

      departureDates: new Set(),
      departurePrices: new Map(),
      departureCheapDates: new Set(),

      returnDates: new Set(),
      returnPrices: new Map(),
      returnCheapDates: new Set(),

      isLoadingOrigins: false,
      isLoadingDestinations: false,
      isLoadingDepartureDates: false,
      isLoadingReturnDates: false,

      originLoaded: false,
      destinationLoaded: false,
      departureDatesLoaded: false,
      returnDatesLoaded: false,

      apiUnavailable: false,
      fallbackReason: null,
      simulateApiFailureStage: null,

      viewDates: {
        departure: new Date(),
        return: new Date()
      },

      openPanel: null,
      calendarTemplates: {}
    };

    const labels = TEXT[state.language] || TEXT.de;

    const els = {
      returnWrapper: widget.querySelector('[data-booking-return-wrapper="true"]'),

      toggle: widget.querySelector('[data-booking-toggle="trip-type"]'),
      toggleGroup: widget.querySelector('[data-booking-toggle-group="true"]'),
      toggleCircle: widget.querySelector('[data-booking-toggle-circle="true"]'),
      toggleRoundtripLabel: widget.querySelector('[data-booking-toggle-label="roundtrip"]'),
      toggleOnewayLabel: widget.querySelector('[data-booking-toggle-label="oneway"]'),

      passengerMinus: widget.querySelector('[data-booking-passengers="minus"]'),
      passengerValue: widget.querySelector('[data-booking-passengers="value"]'),
      passengerPlus: widget.querySelector('[data-booking-passengers="plus"]'),
      passengersWrapper: widget.querySelector('[data-booking-passengers-wrapper="true"]'),

      originField: widget.querySelector('[data-booking-field="origin"]'),
      originLabel: widget.querySelector('[data-booking-label="origin"]'),
      originDropdown: widget.querySelector('[data-booking-dropdown="origin"]'),

      destinationField: widget.querySelector('[data-booking-field="destination"]'),
      destinationLabel: widget.querySelector('[data-booking-label="destination"]'),
      destinationDropdown: widget.querySelector('[data-booking-dropdown="destination"]'),

      departureField: widget.querySelector('[data-booking-field="departure-date"]'),
      departureLabel: widget.querySelector('[data-booking-label="departure-date"]'),
      departureOverlay: widget.querySelector('[data-booking-calendar-overlay="departure"]'),
      departureCalendar: widget.querySelector('[data-booking-calendar="departure"]'),

      returnField: widget.querySelector('[data-booking-field="return-date"]'),
      returnLabel: widget.querySelector('[data-booking-label="return-date"]'),
      returnOverlay: widget.querySelector('[data-booking-calendar-overlay="return"]'),
      returnCalendar: widget.querySelector('[data-booking-calendar="return"]'),

      submit: widget.querySelector('[data-booking-submit="true"]'),
      error: widget.querySelector('[data-booking-error="true"]'),
      fallback: widget.querySelector('[data-booking-fallback="true"]')
    };

    function injectCursorStyles() {
      if (document.getElementById("twiliner-booking-widget-cursor-style")) return;

      const style = document.createElement("style");
      style.id = "twiliner-booking-widget-cursor-style";
      style.textContent = `
        [data-booking-widget="true"] .booking-form-item,
        [data-booking-widget="true"] .booking-form-item-split {
          cursor: default;
        }

        [data-booking-widget="true"] [data-booking-field="origin"],
        [data-booking-widget="true"] [data-booking-field="destination"],
        [data-booking-widget="true"] [data-booking-field="departure-date"],
        [data-booking-widget="true"] [data-booking-field="return-date"],
        [data-booking-widget="true"] [data-booking-passengers="minus"],
        [data-booking-widget="true"] [data-booking-passengers="plus"],
        [data-booking-widget="true"] [data-booking-toggle="trip-type"],
        [data-booking-widget="true"] [data-booking-submit="true"],
        [data-booking-widget="true"] .booking-calendar-nav,
        [data-booking-widget="true"] .booking-calendar-day.is-available {
          cursor: pointer;
        }

        [data-booking-widget="true"] [aria-disabled="true"],
        [data-booking-widget="true"] .booking-calendar-day.is-disabled,
        [data-booking-widget="true"] .booking-calendar-day.is-empty {
          cursor: default;
        }

        [data-booking-widget="true"][data-booking-api-unavailable="true"] *,
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-field],
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-field] *,
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-toggle],
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-toggle] *,
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-toggle-group],
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-toggle-group] *,
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-passengers-wrapper],
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-passengers-wrapper] *,
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-passengers],
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-passengers] * {
          cursor: default !important;
        }

        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-submit="true"],
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-submit="true"] *,
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-fallback="true"],
        [data-booking-widget="true"][data-booking-api-unavailable="true"] [data-booking-fallback="true"] * {
          cursor: pointer !important;
        }
      `;
      document.head.appendChild(style);
    }

    function captureUrlParamsForLater() {
      try {
        const current = new URLSearchParams(window.location.search || "");
        if (!Array.from(current.keys()).length) return;

        const stored = readStoredUrlParams();
        const merged = new Map();

        stored.forEach(function (item) {
          if (!item || !item.key) return;
          merged.set(item.key, item.value || "");
        });

        current.forEach(function (value, key) {
          if (!key || value === "") return;
          merged.set(key, value);
        });

        const payload = Array.from(merged.entries()).map(function (entry) {
          return {
            key: entry[0],
            value: entry[1]
          };
        });

        sessionStorage.setItem(CONFIG.trackingStorageKey, JSON.stringify(payload));
      } catch (_) {
        // Tracking parameters are helpful, but must never break booking.
      }
    }

    function readStoredUrlParams() {
      try {
        const raw = sessionStorage.getItem(CONFIG.trackingStorageKey);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }

    function appendTrackingParams(targetParams) {
      const merged = new Map();

      readStoredUrlParams().forEach(function (item) {
        if (!item || !item.key) return;
        if (TURNIT_PROTECTED_PARAMS.has(item.key)) return;
        merged.set(item.key, item.value || "");
      });

      try {
        const current = new URLSearchParams(window.location.search || "");
        current.forEach(function (value, key) {
          if (!key || value === "") return;
          if (TURNIT_PROTECTED_PARAMS.has(key)) return;
          merged.set(key, value);
        });
      } catch (_) {
        // Ignore URL parsing issues.
      }

      merged.forEach(function (value, key) {
        if (!targetParams.has(key)) {
          targetParams.append(key, value);
        }
      });
    }

    function getTrackingParamsObject() {
      const params = new URLSearchParams();
      appendTrackingParams(params);

      const result = {};
      params.forEach(function (value, key) {
        result[key] = value;
      });

      return result;
    }

    function getCurrentLanguage() {
      const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();

      if (htmlLang.startsWith("en")) return "en";
      if (htmlLang.startsWith("de")) return "de";

      const path = window.location.pathname.toLowerCase();

      if (path === "/en" || path.startsWith("/en/")) return "en";

      return "de";
    }

    function normalizeLookupKey(input) {
      return String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function stripTrailingCountryCode(label) {
      return String(label || "").replace(/\s*\([A-Z]{2}\)\s*$/, "");
    }

    function setLabelPlaceholder(labelEl, text) {
      if (!labelEl) return;

      labelEl.textContent = text;
      labelEl.style.color = "";
    }

    function setLabelSelected(labelEl, text) {
      if (!labelEl) return;

      labelEl.textContent = text;
      labelEl.style.color = CONFIG.selectedTextColor;
    }

    function formatIsoDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return year + "-" + month + "-" + day;
    }

    function parseIsoDate(iso) {
      return new Date(String(iso) + "T00:00:00");
    }

    function getWeekdayLabel(date) {
      const day = date.getDay();
      const mondayBasedIndex = day === 0 ? 6 : day - 1;
      return labels.weekdays[mondayBasedIndex] || "";
    }

    function formatSelectedDate(iso) {
      const date = parseIsoDate(iso);
      const weekday = getWeekdayLabel(date);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = String(date.getFullYear()).slice(-2);

      return weekday + ", " + day + "." + month + "." + year;
    }

    function formatPriceForCalendar(price) {
      const numeric = Number(price);

      if (!Number.isFinite(numeric)) return "";

      const francs = numeric >= 1000 ? numeric / 100 : numeric;
      const rounded = Math.round(francs);

      return "CHF " + String(rounded);
    }

    function createUUID() {
      try {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) {
          return (
            c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >>
              (c / 4)
          ).toString(16);
        });
      } catch (_) {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
          const r = Math.random() * 16 | 0;
          const v = c === "x" ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    }

    function getLegacyCodeForPlace(place, cleanedLabel) {
      const lookupKeys = [
        normalizeLookupKey(cleanedLabel),
        normalizeLookupKey(place.label),
        normalizeLookupKey(place.name),
        normalizeLookupKey(place.name_de),
        normalizeLookupKey(place.name_en),
        normalizeLookupKey(place.name_fr),
        normalizeLookupKey(place.key)
      ].filter(Boolean);

      for (let i = 0; i < lookupKeys.length; i += 1) {
        if (LEGACY_CITY_CODE_MAP[lookupKeys[i]]) {
          return LEGACY_CITY_CODE_MAP[lookupKeys[i]];
        }
      }

      return null;
    }

    function getTurnitCityName(place, cleanedLabel, legacyCode) {
      if (legacyCode && TURNIT_CITY_NAME_BY_LEGACY_CODE[legacyCode]) {
        return TURNIT_CITY_NAME_BY_LEGACY_CODE[legacyCode];
      }

      return (
        place.name_en ||
        place.key ||
        place.name ||
        cleanedLabel ||
        place.label ||
        ""
      );
    }

    function mapPlace(place) {
      const cleanedLabel = stripTrailingCountryCode(place.label);
      const legacyCode = getLegacyCodeForPlace(place, cleanedLabel);
      const turnitCityName = getTurnitCityName(place, cleanedLabel, legacyCode);

      return {
        value: legacyCode || place.id,
        apiId: place.id,
        label: cleanedLabel || place.label || place.name || "",
        cityName: place.name || cleanedLabel || place.label || "",
        turnitLabel: turnitCityName,
        turnitCityName: turnitCityName,
        raw: place
      };
    }

    function sortPlacesAlphabetically(places) {
      return places.slice().sort(function (a, b) {
        return String(a.label || "").localeCompare(String(b.label || ""), state.language, {
          sensitivity: "base"
        });
      });
    }

    function makeApiError(stage, message, url, status, originalError) {
      return {
        stage: stage || "unknown",
        message: message || "Unknown API error",
        url: url || null,
        status: status || null,
        timestamp: new Date().toISOString(),
        originalErrorName: originalError && originalError.name ? originalError.name : null
      };
    }

    async function apiGet(path, query, stage) {
      const url = new URL(
        CONFIG.apiBaseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "")
      );

      Object.keys(query || {}).forEach(function (key) {
        const value = query[key];

        if (value !== null && value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      });

      const urlString = url.toString();

      if (
        state.simulateApiFailureStage === "any" ||
        state.simulateApiFailureStage === stage
      ) {
        state.simulateApiFailureStage = null;
        throw makeApiError(
          stage,
          "Simulated API failure",
          urlString,
          null,
          { name: "SimulatedFailure" }
        );
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(function () {
        controller.abort();
      }, CONFIG.apiTimeoutMs);

      try {
        const response = await fetch(urlString, {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });

        if (!response.ok) {
          let message = "HTTP " + response.status;

          try {
            const payload = await response.json();
            if (payload && payload.message) {
              message = payload.message + " (HTTP " + response.status + ")";
            }
          } catch (_) {
            // Keep default HTTP message.
          }

          throw makeApiError(stage, message, urlString, response.status, null);
        }

        return await response.json();
      } catch (error) {
        if (error && error.stage && error.message && error.url) {
          throw error;
        }

        if (error && error.name === "AbortError") {
          throw makeApiError(
            stage,
            "API timeout after " + (CONFIG.apiTimeoutMs / 1000) + "s",
            urlString,
            null,
            error
          );
        }

        throw makeApiError(
          stage,
          error && error.message ? error.message : "Network/API error",
          urlString,
          null,
          error
        );
      } finally {
        window.clearTimeout(timeout);
      }
    }

    function getPanelContent(panel) {
      if (!panel) return null;

      return (
        panel.querySelector(".dropdown-list-content") ||
        panel.querySelector(".dropdown-list-item") ||
        panel
      );
    }

    function preparePanel(panel) {
      if (!panel) return;

      panel.style.display = "none";
      panel.style.opacity = "0";
      panel.style.transform = "translateY(0.5rem)";
      panel.style.transition =
        "opacity " + CONFIG.panelTransitionMs + "ms ease-in-out, transform " + CONFIG.panelTransitionMs + "ms ease-in-out";
      panel.style.pointerEvents = "none";
    }

    function prepareCalendarTarget(calendar) {
      if (!calendar) return;

      calendar.style.display = "";
      calendar.style.opacity = "";
      calendar.style.transform = "";
      calendar.style.transition = "";
      calendar.style.pointerEvents = "";
    }

    function openPanel(panel) {
      if (!panel || state.apiUnavailable) return;

      if (state.openPanel && state.openPanel !== panel) {
        closePanel(state.openPanel, true);
      }

      state.openPanel = panel;

      panel.style.display = "block";
      panel.style.pointerEvents = "auto";

      window.requestAnimationFrame(function () {
        panel.style.opacity = "1";
        panel.style.transform = "translateY(0)";
      });
    }

    function closePanel(panel, instant) {
      if (!panel) return;

      if (state.openPanel === panel) {
        state.openPanel = null;
      }

      if (instant) {
        panel.style.opacity = "0";
        panel.style.transform = "translateY(0.5rem)";
        panel.style.pointerEvents = "none";
        panel.style.display = "none";
        return;
      }

      panel.style.opacity = "0";
      panel.style.transform = "translateY(0.5rem)";
      panel.style.pointerEvents = "none";

      window.setTimeout(function () {
        if (state.openPanel !== panel) {
          panel.style.display = "none";
        }
      }, CONFIG.panelTransitionMs);
    }

    function togglePanel(panel) {
      if (!panel || state.apiUnavailable) return;

      const isOpen = state.openPanel === panel && panel.style.display !== "none";

      if (isOpen) {
        closePanel(panel);
      } else {
        openPanel(panel);
      }
    }

    function closeAllPanels() {
      closePanel(els.originDropdown);
      closePanel(els.destinationDropdown);
      closePanel(els.departureOverlay);
      closePanel(els.returnOverlay);
    }

    function setElementDisabled(el, isDisabled) {
      if (!el) return;

      el.style.opacity = isDisabled ? "0.4" : "";
      el.style.pointerEvents = isDisabled ? "none" : "";
      el.setAttribute("aria-disabled", isDisabled ? "true" : "false");
    }

    function setFieldLoading(field, isLoading) {
      if (!field || state.apiUnavailable) return;

      field.style.opacity = isLoading ? "0.6" : "";
      field.style.pointerEvents = isLoading ? "none" : "";
      field.setAttribute("aria-busy", isLoading ? "true" : "false");
    }

    function setFieldActiveStyle(field, isActive) {
      if (!field) return;

      if (state.apiUnavailable) {
        field.style.opacity = "0.4";
        field.style.pointerEvents = "none";
        field.setAttribute("aria-disabled", "true");
        return;
      }

      field.style.opacity = isActive ? "" : "0.4";
      field.style.pointerEvents = "";
      field.setAttribute("aria-disabled", isActive ? "false" : "true");
    }

    function hardDisable(el) {
      if (!el) return;

      el.style.opacity = "0.4";
      el.style.pointerEvents = "none";
      el.setAttribute("aria-disabled", "true");
    }

    function showError(message) {
      if (!els.error) return;

      els.error.textContent = message;
      els.error.style.display = "block";
    }

    function hideError() {
      if (!els.error) return;

      els.error.style.display = "none";
    }

    function buildFallbackUrl() {
      try {
        const url = new URL(CONFIG.bookingBaseUrl);
        const params = new URLSearchParams();

        params.set("language", state.language);
        appendTrackingParams(params);

        const query = params.toString();
        return query ? url.toString().replace(/\?$/, "") + "?" + query : url.toString();
      } catch (_) {
        return CONFIG.bookingBaseUrl;
      }
    }

    function showFallback() {
      if (!els.fallback) return;

      els.fallback.textContent = labels.directBooking;
      els.fallback.style.display = "inline-block";
      els.fallback.setAttribute("href", buildFallbackUrl());
    }

    function hideFallback() {
      if (!els.fallback) return;

      els.fallback.style.display = "none";
    }

    function activateFallbackMode(reason) {
      const fallbackReason = reason && typeof reason === "object"
        ? reason
        : makeApiError("unknown", String(reason || labels.fallbackMessage), null, null, null);

      state.apiUnavailable = true;
      state.fallbackReason = fallbackReason;

      widget.setAttribute("data-booking-api-unavailable", "true");

      closeAllPanels();

      hardDisable(els.originField);
      hardDisable(els.destinationField);
      hardDisable(els.departureField);
      hardDisable(els.returnField);
      hardDisable(els.toggle);
      hardDisable(els.toggleGroup);
      hardDisable(els.passengerMinus);
      hardDisable(els.passengerPlus);
      hardDisable(els.passengersWrapper);

      if (els.submit) {
        els.submit.style.opacity = "";
        els.submit.style.pointerEvents = "";
        els.submit.setAttribute("aria-disabled", "false");
      }

      showError(labels.fallbackMessage);
      showFallback();

      console.warn("Twiliner fallback mode activated:", fallbackReason);
    }

    function renderPassengers() {
      if (!els.passengerValue) return;

      els.passengerValue.textContent = String(state.passengers);

      setElementDisabled(
        els.passengerMinus,
        state.passengers <= CONFIG.minPassengers
      );

      setElementDisabled(
        els.passengerPlus,
        state.passengers >= CONFIG.maxPassengers
      );
    }

    function increasePassengers(event) {
      if (event) event.preventDefault();
      if (state.apiUnavailable) return;

      if (state.passengers >= CONFIG.maxPassengers) return;

      state.passengers += 1;
      renderPassengers();
    }

    function decreasePassengers(event) {
      if (event) event.preventDefault();
      if (state.apiUnavailable) return;

      if (state.passengers <= CONFIG.minPassengers) return;

      state.passengers -= 1;
      renderPassengers();
    }

    function ensureReturnFieldReadyAfterRoundtrip() {
      if (state.apiUnavailable) return;
      if (state.tripType !== "roundtrip") return;

      if (!state.selectedOrigin || !state.selectedDestination || !state.selectedDepartureDate) {
        setFieldActiveStyle(els.returnField, false);
        return;
      }

      if (state.returnDatesLoaded) {
        setFieldActiveStyle(els.returnField, state.returnDates.size > 0);
        return;
      }

      if (!state.isLoadingReturnDates) {
        loadReturnDates();
      }
    }

    function renderTripType() {
      const isOneway = state.tripType === "oneway";

      if (els.returnWrapper) {
        els.returnWrapper.style.display = isOneway ? "none" : "";
      }

      if (els.toggleRoundtripLabel) {
        els.toggleRoundtripLabel.style.color = isOneway
          ? "rgb(167, 167, 167)"
          : "rgb(255, 255, 255)";
      }

      if (els.toggleOnewayLabel) {
        els.toggleOnewayLabel.style.color = isOneway
          ? "rgb(255, 255, 255)"
          : "rgb(167, 167, 167)";
      }

      if (isOneway) {
        closePanel(els.returnOverlay, true);
      }

      widget.setAttribute("data-booking-trip-type", state.tripType);
    }

    function toggleTripType(event) {
      if (event) event.preventDefault();
      if (state.apiUnavailable) return;

      state.tripType = state.tripType === "roundtrip" ? "oneway" : "roundtrip";

      if (state.tripType === "oneway") {
        resetReturnDateOnly();
      }

      renderTripType();

      if (state.tripType === "roundtrip") {
        ensureReturnFieldReadyAfterRoundtrip();
      }
    }

    function renderDropdownOptions(panel, options, onSelect, emptyText) {
      const content = getPanelContent(panel);
      if (!content) return;

      content.innerHTML = "";

      if (!options.length) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "dropdown-item";
        emptyItem.textContent = emptyText || labels.noDepartures;
        emptyItem.style.cursor = "default";
        content.appendChild(emptyItem);
        return;
      }

      options.forEach(function (option) {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.textContent = option.label;
        item.setAttribute("role", "option");
        item.setAttribute("tabindex", "0");

        item.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          if (state.apiUnavailable) return;
          onSelect(option);
        });

        item.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (state.apiUnavailable) return;
            onSelect(option);
          }
        });

        content.appendChild(item);
      });
    }

    function resetDestination() {
      state.selectedDestination = null;
      state.destinationPlaces = [];
      state.destinationLoaded = false;

      setLabelPlaceholder(els.destinationLabel, labels.choose);
      renderDropdownOptions(
        els.destinationDropdown,
        [],
        function () {},
        labels.noDestinations
      );

      setFieldActiveStyle(els.destinationField, false);
      closePanel(els.destinationDropdown, true);
    }

    function resetReturnDateOnly() {
      state.selectedReturnDate = null;
      state.returnDates = new Set();
      state.returnPrices = new Map();
      state.returnCheapDates = new Set();
      state.returnDatesLoaded = false;

      setLabelPlaceholder(els.returnLabel, labels.chooseDate);
      setFieldActiveStyle(els.returnField, false);
      closePanel(els.returnOverlay, true);
    }

    function resetDates() {
      state.selectedDepartureDate = null;
      state.selectedReturnDate = null;

      state.departureDates = new Set();
      state.departurePrices = new Map();
      state.departureCheapDates = new Set();

      state.returnDates = new Set();
      state.returnPrices = new Map();
      state.returnCheapDates = new Set();

      state.departureDatesLoaded = false;
      state.returnDatesLoaded = false;

      setLabelPlaceholder(els.departureLabel, labels.chooseDate);
      setLabelPlaceholder(els.returnLabel, labels.chooseDate);

      setFieldActiveStyle(els.departureField, false);
      setFieldActiveStyle(els.returnField, false);

      closePanel(els.departureOverlay, true);
      closePanel(els.returnOverlay, true);
    }

    async function setOrigin(origin) {
      if (state.apiUnavailable) return;

      state.selectedOrigin = origin;

      setLabelSelected(els.originLabel, origin.label);

      hideError();
      closePanel(els.originDropdown);

      resetDestination();
      resetDates();

      await loadDestinationPlaces();
    }

    async function setDestination(destination) {
      if (state.apiUnavailable) return;

      state.selectedDestination = destination;

      setLabelSelected(els.destinationLabel, destination.label);

      hideError();
      closePanel(els.destinationDropdown);

      resetDates();

      await loadDepartureDates();
    }

    async function loadDeparturePlaces() {
      if (state.apiUnavailable) return;
      if (state.isLoadingOrigins || state.originLoaded) return;

      state.isLoadingOrigins = true;

      setFieldLoading(els.originField, true);

      if (!state.selectedOrigin) {
        setLabelPlaceholder(els.originLabel, labels.loading);
      }

      try {
        const apiLanguage = API_LANGUAGE_MAP[state.language] || "de";

        const payload = await apiGet("get-places", {
          type: "departure",
          language: apiLanguage,
          operator_id: CONFIG.operatorId
        }, "departure-places");

        const places = Array.isArray(payload)
          ? payload.map(mapPlace).filter(function (place) {
              return Boolean(place.label && place.apiId);
            })
          : [];

        state.originPlaces = sortPlacesAlphabetically(places);
        state.originLoaded = true;

        renderDropdownOptions(
          els.originDropdown,
          state.originPlaces,
          setOrigin,
          labels.noDepartures
        );

        if (!state.selectedOrigin) {
          setLabelPlaceholder(els.originLabel, labels.choose);
        }
      } catch (error) {
        console.error("Twiliner origin API error:", error);

        setLabelPlaceholder(els.originLabel, labels.choose);
        activateFallbackMode(error);
      } finally {
        state.isLoadingOrigins = false;
        setFieldLoading(els.originField, false);
      }
    }

    async function loadDestinationPlaces() {
      if (state.apiUnavailable) return;

      if (!state.selectedOrigin) {
        resetDestination();
        return;
      }

      state.isLoadingDestinations = true;
      state.destinationLoaded = false;

      setFieldLoading(els.destinationField, true);
      setLabelPlaceholder(els.destinationLabel, labels.loading);

      try {
        const apiLanguage = API_LANGUAGE_MAP[state.language] || "de";

        const payload = await apiGet("get-places", {
          type: "arrival",
          language: apiLanguage,
          operator_id: CONFIG.operatorId,
          place_departure_id: state.selectedOrigin.apiId
        }, "destination-places");

        const places = Array.isArray(payload)
          ? payload.map(mapPlace).filter(function (place) {
              return Boolean(place.label && place.apiId);
            })
          : [];

        state.destinationPlaces = sortPlacesAlphabetically(places);
        state.destinationLoaded = true;

        renderDropdownOptions(
          els.destinationDropdown,
          state.destinationPlaces,
          setDestination,
          labels.noDestinations
        );

        setLabelPlaceholder(els.destinationLabel, labels.choose);
        setFieldActiveStyle(els.destinationField, state.destinationPlaces.length > 0);
      } catch (error) {
        console.error("Twiliner destination API error:", error);

        setLabelPlaceholder(els.destinationLabel, labels.choose);
        activateFallbackMode(error);
      } finally {
        state.isLoadingDestinations = false;
        setFieldLoading(els.destinationField, false);

        if (!state.destinationPlaces.length && !state.apiUnavailable) {
          setFieldActiveStyle(els.destinationField, false);
        }
      }
    }

    async function loadConnectionDates(type) {
      if (state.apiUnavailable) return;

      const isReturn = type === "return";

      if (!state.selectedOrigin || !state.selectedDestination) {
        if (!isReturn) setFieldActiveStyle(els.departureField, false);
        if (isReturn) setFieldActiveStyle(els.returnField, false);
        return;
      }

      if (isReturn && !state.selectedDepartureDate) {
        setFieldActiveStyle(els.returnField, false);
        return;
      }

      if (isReturn) {
        state.isLoadingReturnDates = true;
        state.returnDatesLoaded = false;
        setFieldLoading(els.returnField, true);
      } else {
        state.isLoadingDepartureDates = true;
        state.departureDatesLoaded = false;
        setFieldLoading(els.departureField, true);
      }

      try {
        const departureId = isReturn
          ? state.selectedDestination.apiId
          : state.selectedOrigin.apiId;

        const arrivalId = isReturn
          ? state.selectedOrigin.apiId
          : state.selectedDestination.apiId;

        const payload = await apiGet("get-connection-dates", {
          place_departure_id: departureId,
          place_arrival_id: arrivalId,
          operator_id: CONFIG.operatorId,
          currency: CONFIG.currency
        }, isReturn ? "return-dates" : "departure-dates");

        const dates = new Set();
        const prices = new Map();
        const cheapDates = new Set();

        if (Array.isArray(payload)) {
          payload.forEach(function (item) {
            if (!item || !item.date || !item.best_offer) return;

            const price = item.best_offer.price;

            if (price === null || price === undefined) return;

            if (isReturn && state.selectedDepartureDate) {
              const returnDate = parseIsoDate(item.date);
              const departureDate = parseIsoDate(state.selectedDepartureDate);

              if (returnDate <= departureDate) {
                return;
              }
            }

            dates.add(item.date);
            prices.set(item.date, formatPriceForCalendar(price));

            if (item.best_offer.cheap) {
              cheapDates.add(item.date);
            }
          });
        }

        const firstAvailableDate = Array.from(dates).sort()[0];

        if (isReturn) {
          state.returnDates = dates;
          state.returnPrices = prices;
          state.returnCheapDates = cheapDates;
          state.returnDatesLoaded = true;

          if (firstAvailableDate) {
            const date = parseIsoDate(firstAvailableDate);
            state.viewDates.return = new Date(date.getFullYear(), date.getMonth(), 1);
          } else if (state.selectedDepartureDate) {
            const date = parseIsoDate(state.selectedDepartureDate);
            state.viewDates.return = new Date(date.getFullYear(), date.getMonth(), 1);
          }

          drawCalendar("return");
          setFieldActiveStyle(els.returnField, dates.size > 0);
} else {
  state.departureDates = dates;
  state.departurePrices = prices;
  state.departureCheapDates = cheapDates;
  state.departureDatesLoaded = true;

  if (firstAvailableDate) {
    const date = parseIsoDate(firstAvailableDate);
    state.viewDates.departure = new Date(date.getFullYear(), date.getMonth(), 1);
  } else {
    const today = new Date();
    state.viewDates.departure = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  drawCalendar("departure");
  setFieldActiveStyle(els.departureField, dates.size > 0);

  if (dates.size === 0) {
    showError(labels.noBookableDates || labels.noDates);
  } else {
    hideError();
  }
}
      } catch (error) {
        console.error("Twiliner " + type + " dates API error:", error);
        activateFallbackMode(error);
      } finally {
        if (isReturn) {
          state.isLoadingReturnDates = false;
          setFieldLoading(els.returnField, false);

          if (!state.apiUnavailable) {
            setFieldActiveStyle(els.returnField, state.returnDates.size > 0);
          }
        } else {
          state.isLoadingDepartureDates = false;
          setFieldLoading(els.departureField, false);

          if (!state.apiUnavailable) {
            setFieldActiveStyle(els.departureField, state.departureDates.size > 0);
          }
        }
      }
    }

    function loadDepartureDates() {
      return loadConnectionDates("departure");
    }

    function loadReturnDates() {
      return loadConnectionDates("return");
    }

    function captureCalendarTemplate(type) {
      const calendar = type === "departure" ? els.departureCalendar : els.returnCalendar;
      if (!calendar) return null;

      const template = {
        dropdownListItemClass:
          calendar.querySelector(".dropdown-list-item")?.className || "dropdown-list-item",
        dropdownListContentClass:
          calendar.querySelector(".dropdown-list-content")?.className || "dropdown-list-content",

        headerClass:
          calendar.querySelector(".booking-calendar-header")?.className || "booking-calendar-header",
        prevClass:
          calendar.querySelector(".booking-calendar-prev")?.className || "booking-calendar-nav booking-calendar-prev",
        nextClass:
          calendar.querySelector(".booking-calendar-next")?.className || "booking-calendar-nav booking-calendar-next",
        prevInner:
          calendar.querySelector(".booking-calendar-prev")?.innerHTML || "",
        nextInner:
          calendar.querySelector(".booking-calendar-next")?.innerHTML || "",
        monthWrapperClass:
          calendar.querySelector(".booking-calendar-month")?.className || "booking-calendar-month",
        monthTextClass:
          calendar.querySelector(".calendar-month")?.className || "calendar-month",

        weekdaysClass:
          calendar.querySelector(".booking-calendar-weekdays")?.className || "booking-calendar-weekdays",
        weekdayClass:
          calendar.querySelector(".booking-calendar-weekday")?.className || "booking-calendar-weekday",
        weekdayTextClass:
          calendar.querySelector(".calendar-day")?.className || "calendar-day",

        gridClass:
          calendar.querySelector(".booking-calendar-grid")?.className || "booking-calendar-grid",
        lineClass:
          calendar.querySelector(".booking-calendar-line")?.className || "booking-calendar-line",
        dayClass:
          stripStateClasses(calendar.querySelector(".booking-calendar-day")?.className || "booking-calendar-day"),
        dateClass:
          stripStateClasses(calendar.querySelector(".calendar-date")?.className || "calendar-date"),
        priceClass:
          stripStateClasses(calendar.querySelector(".calendar-price")?.className || "calendar-price")
      };

      return template;
    }

    function stripStateClasses(className) {
      return String(className || "")
        .split(/\s+/)
        .filter(function (name) {
          return (
            name &&
            name !== "is-available" &&
            name !== "is-disabled" &&
            name !== "is-selected" &&
            name !== "is-cheap" &&
            name !== "is-empty"
          );
        })
        .join(" ");
    }

    function createElement(tag, className, text) {
      const el = document.createElement(tag);

      if (className) {
        el.className = className;
      }

      if (text !== undefined && text !== null) {
        el.textContent = text;
      }

      return el;
    }

    function clearAndCreateCalendarShell(type) {
      const calendar = type === "departure" ? els.departureCalendar : els.returnCalendar;
      const template = state.calendarTemplates[type];

      if (!calendar || !template) return null;

      prepareCalendarTarget(calendar);

      calendar.innerHTML = "";

      const item = createElement("div", template.dropdownListItemClass);
      const content = createElement("div", template.dropdownListContentClass);

      item.appendChild(content);
      calendar.appendChild(item);

      return content;
    }

    function getCalendarData(type) {
      if (type === "return") {
        return {
          dates: state.returnDates,
          prices: state.returnPrices,
          cheapDates: state.returnCheapDates,
          selectedDate: state.selectedReturnDate,
          viewDate: state.viewDates.return,
          minDateIso: state.selectedDepartureDate
        };
      }

      return {
        dates: state.departureDates,
        prices: state.departurePrices,
        cheapDates: state.departureCheapDates,
        selectedDate: state.selectedDepartureDate,
        viewDate: state.viewDates.departure,
        minDateIso: null
      };
    }

    function setCalendarViewDate(type, date) {
      if (type === "return") {
        state.viewDates.return = date;
      } else {
        state.viewDates.departure = date;
      }
    }

    function drawCalendar(type) {
      const calendar = type === "departure" ? els.departureCalendar : els.returnCalendar;
      const template = state.calendarTemplates[type];

      if (!calendar || !template) return;

      const content = clearAndCreateCalendarShell(type);
      if (!content) return;

      const data = getCalendarData(type);
      const viewDate = data.viewDate || new Date();
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();

      const header = createElement("div", template.headerClass);

      const prev = createElement("button", template.prevClass);
      prev.type = "button";
      prev.innerHTML = template.prevInner;
      prev.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        setCalendarViewDate(type, new Date(year, month - 1, 1));
        drawCalendar(type);
      });

      const monthWrapper = createElement("div", template.monthWrapperClass);
      const monthText = createElement(
        "div",
        template.monthTextClass,
        labels.months[month] + " " + year
      );
      monthWrapper.appendChild(monthText);

      const next = createElement("button", template.nextClass);
      next.type = "button";
      next.innerHTML = template.nextInner;
      next.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        setCalendarViewDate(type, new Date(year, month + 1, 1));
        drawCalendar(type);
      });

      header.appendChild(prev);
      header.appendChild(monthWrapper);
      header.appendChild(next);

      const weekdays = createElement("div", template.weekdaysClass);
      labels.weekdays.forEach(function (weekday) {
        const weekdayEl = createElement("div", template.weekdayClass);
        const weekdayText = createElement("div", template.weekdayTextClass, weekday);
        weekdayEl.appendChild(weekdayText);
        weekdays.appendChild(weekdayEl);
      });

      const grid = createElement("div", template.gridClass);

      const cells = buildCalendarCells(type, year, month);
      for (let i = 0; i < cells.length; i += 7) {
        const line = createElement("div", template.lineClass);
        const rowCells = cells.slice(i, i + 7);

        rowCells.forEach(function (cell) {
          line.appendChild(cell);
        });

        grid.appendChild(line);
      }

      content.appendChild(header);
      content.appendChild(weekdays);
      content.appendChild(grid);
    }

    function createEmptyCalendarCell(type) {
      const template = state.calendarTemplates[type];
      const empty = createElement("div", template.dayClass + " is-empty");

      const dateEl = createElement("div", template.dateClass + " is-empty", "");
      const priceEl = createElement("div", template.priceClass + " is-empty", "");

      empty.appendChild(dateEl);
      empty.appendChild(priceEl);

      return empty;
    }

    function buildCalendarCells(type, year, month) {
      const template = state.calendarTemplates[type];
      const data = getCalendarData(type);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const minDate = data.minDateIso ? parseIsoDate(data.minDateIso) : null;
      if (minDate) minDate.setHours(0, 0, 0, 0);

      const firstDay = new Date(year, month, 1);
      const firstDayIndex = firstDay.getDay();
      const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const cells = [];

      for (let i = 0; i < offset; i += 1) {
        cells.push(createEmptyCalendarCell(type));
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);

        const iso = formatIsoDate(date);
        const isAfterDeparture = !minDate || date > minDate;
        const available = data.dates.has(iso) && isAfterDeparture;
        const selected = data.selectedDate === iso;
        const cheap = data.cheapDates.has(iso);
        const past = date < today;

        const dayClasses = [template.dayClass];

        if (available && !past) {
          dayClasses.push("is-available");
        } else {
          dayClasses.push("is-disabled");
        }

        if (selected) {
          dayClasses.push("is-selected");
        }

        if (cheap) {
          dayClasses.push("is-cheap");
        }

        const dayEl = createElement("button", dayClasses.join(" "));
        dayEl.type = "button";

        const dateElClasses = [template.dateClass];
        const priceElClasses = [template.priceClass];

        if (!available || past) {
          dateElClasses.push("is-disabled");
          priceElClasses.push("is-disabled");
        }

        if (cheap) {
          priceElClasses.push("is-cheap");
        }

        const dateEl = createElement("div", dateElClasses.join(" "), String(day));
        const price = data.prices.get(iso);
        const priceEl = createElement("div", priceElClasses.join(" "), price || "");

        dayEl.appendChild(dateEl);
        dayEl.appendChild(priceEl);

        if (available && !past) {
          dayEl.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (state.apiUnavailable) return;

            if (type === "return") {
              selectReturnDate(iso);
            } else {
              selectDepartureDate(iso);
            }
          });
        } else {
          dayEl.disabled = true;
          dayEl.setAttribute("aria-disabled", "true");
        }

        cells.push(dayEl);
      }

      while (cells.length % 7 !== 0) {
        cells.push(createEmptyCalendarCell(type));
      }

      return cells;
    }

    async function selectDepartureDate(iso) {
      if (state.apiUnavailable) return;

      state.selectedDepartureDate = iso;

      setLabelSelected(els.departureLabel, formatSelectedDate(iso));

      resetReturnDateOnly();

      drawCalendar("departure");
      closePanel(els.departureOverlay);

      if (state.tripType === "roundtrip") {
        await loadReturnDates();
      }
    }

    function selectReturnDate(iso) {
      if (state.apiUnavailable) return;

      state.selectedReturnDate = iso;

      setLabelSelected(els.returnLabel, formatSelectedDate(iso));

      drawCalendar("return");
      closePanel(els.returnOverlay);
    }

    async function handleOriginClick(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (state.apiUnavailable) return;

      hideError();

      await loadDeparturePlaces();

      if (state.originLoaded) {
        togglePanel(els.originDropdown);
      }
    }

    function handleDestinationClick(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (state.apiUnavailable) return;

      hideError();

      if (!state.selectedOrigin) {
        showError(labels.selectOriginFirst);
        return;
      }

      if (!state.destinationLoaded || !state.destinationPlaces.length) {
        return;
      }

      togglePanel(els.destinationDropdown);
    }

    async function handleDepartureDateClick(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (state.apiUnavailable) return;

      hideError();

      if (!state.selectedOrigin) {
        showError(labels.selectOriginFirst);
        return;
      }

      if (!state.selectedDestination) {
        showError(labels.selectDestinationFirst);
        return;
      }

      if (!state.departureDatesLoaded && !state.isLoadingDepartureDates) {
        await loadDepartureDates();
      }

      if (!state.departureDates.size) {
        showError(labels.noDates);
        return;
      }

      drawCalendar("departure");
      togglePanel(els.departureOverlay);
    }

    async function handleReturnDateClick(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (state.apiUnavailable) return;

      hideError();

      if (state.tripType === "oneway") {
        return;
      }

      if (!state.selectedOrigin || !state.selectedDestination) {
        showError(labels.selectRouteFirst);
        return;
      }

      if (!state.selectedDepartureDate) {
        showError(labels.selectDepartureFirst);
        return;
      }

      if (!state.returnDatesLoaded && !state.isLoadingReturnDates) {
        await loadReturnDates();
      }

      if (!state.returnDates.size) {
        showError(labels.noDates);
        return;
      }

      drawCalendar("return");
      togglePanel(els.returnOverlay);
    }

    function validateSelection() {
      if (state.apiUnavailable) {
        return true;
      }

      if (!state.selectedOrigin) {
        showError(labels.selectOriginFirst);
        return false;
      }

      if (!state.selectedDestination) {
        showError(labels.selectDestinationFirst);
        return false;
      }

      if (!state.selectedDepartureDate) {
        showError(labels.selectDepartureFirst);
        return false;
      }

      hideError();
      return true;
    }

    function buildPassengersPayload() {
      const passengers = [];

      for (let i = 0; i < state.passengers; i += 1) {
        passengers.push({
          externalReference: createUUID(),
          type: "PERSON",
          isAdult: true,
          passengerTypeId: 1,
          ageFrom: 0,
          ageTo: 120
        });
      }

      return passengers;
    }

    function buildTurnitUrl() {
      if (state.apiUnavailable) {
        return buildFallbackUrl();
      }

      if (!validateSelection()) return null;

      const originPayload = {
        value: state.selectedOrigin.value,
        label: state.selectedOrigin.turnitLabel || state.selectedOrigin.label,
        cityName: state.selectedOrigin.turnitCityName || state.selectedOrigin.cityName
      };

      const destinationPayload = {
        value: state.selectedDestination.value,
        label: state.selectedDestination.turnitLabel || state.selectedDestination.label,
        cityName: state.selectedDestination.turnitCityName || state.selectedDestination.cityName
      };

      const params = new URLSearchParams({
        language: state.language,
        origin: JSON.stringify(originPayload),
        destination: JSON.stringify(destinationPayload),
        departureDate: state.selectedDepartureDate + "T00:00:00",
        passengers: JSON.stringify(buildPassengersPayload()),
        productType: "ticket"
      });

      if (state.selectedReturnDate) {
        params.append("returnDate", state.selectedReturnDate + "T00:00:00");
      }

      appendTrackingParams(params);

      return CONFIG.bookingBaseUrl.replace(/\/?$/, "/") + "?" + params.toString();
    }

    function handleSubmit(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      const url = state.apiUnavailable ? buildFallbackUrl() : buildTurnitUrl();

      if (!url) return;

      try {
        if (CONFIG.openInNewTab) {
          window.open(url, "_blank", "noopener");
        } else {
          window.location.href = url;
        }
      } catch (error) {
        console.error("Twiliner booking link error:", error);
        showError(labels.bookingLinkError);
        showFallback();
      }
    }

    function inspectTurnitPayload() {
      const url = buildTurnitUrl();

      if (!url) {
        return {
          valid: false,
          apiUnavailable: state.apiUnavailable,
          fallbackReason: state.fallbackReason,
          url: null
        };
      }

      const params = new URL(url).searchParams;

      let origin = null;
      let destination = null;
      let passengers = [];

      try {
        origin = params.get("origin") ? JSON.parse(params.get("origin")) : null;
      } catch (_) {}

      try {
        destination = params.get("destination") ? JSON.parse(params.get("destination")) : null;
      } catch (_) {}

      try {
        passengers = params.get("passengers") ? JSON.parse(params.get("passengers")) : [];
      } catch (_) {}

      return {
        valid: true,
        apiUnavailable: state.apiUnavailable,
        fallbackReason: state.fallbackReason,
        language: params.get("language"),
        origin: origin,
        destination: destination,
        departureDate: params.get("departureDate"),
        returnDate: params.get("returnDate"),
        passengers: Array.isArray(passengers) ? passengers.length : null,
        productType: params.get("productType"),
        trackingParams: getTrackingParamsObject(),
        url: url
      };
    }

    function getStatus() {
      return {
        apiUnavailable: state.apiUnavailable,
        fallbackReason: state.fallbackReason,
        language: state.language,
        tripType: state.tripType,
        passengers: state.passengers,
        selectedOrigin: state.selectedOrigin,
        selectedDestination: state.selectedDestination,
        selectedDepartureDate: state.selectedDepartureDate,
        selectedReturnDate: state.selectedReturnDate,
        originLoaded: state.originLoaded,
        destinationLoaded: state.destinationLoaded,
        departureDatesLoaded: state.departureDatesLoaded,
        returnDatesLoaded: state.returnDatesLoaded,
        departureDatesCount: state.departureDates.size,
        returnDatesCount: state.returnDates.size,
        storedUrlParams: readStoredUrlParams()
      };
    }

    function simulateFallback() {
      activateFallbackMode(makeApiError(
        "manual-test",
        "Manually triggered fallback test",
        null,
        null,
        { name: "ManualTest" }
      ));

      return getStatus();
    }

    function simulateApiFailureOnce(stage) {
      state.simulateApiFailureStage = stage || "any";

      return {
        message: "The next matching API call will fail once.",
        stage: state.simulateApiFailureStage
      };
    }

    function bindEvents() {
      if (els.passengerMinus) {
        els.passengerMinus.addEventListener("click", decreasePassengers);
      }

      if (els.passengerPlus) {
        els.passengerPlus.addEventListener("click", increasePassengers);
      }

      if (els.toggle) {
        els.toggle.addEventListener("click", toggleTripType);
      }

      if (els.toggleRoundtripLabel) {
        els.toggleRoundtripLabel.addEventListener("click", function (event) {
          event.preventDefault();

          if (state.apiUnavailable) return;

          state.tripType = "roundtrip";
          renderTripType();
          ensureReturnFieldReadyAfterRoundtrip();
        });
      }

      if (els.toggleOnewayLabel) {
        els.toggleOnewayLabel.addEventListener("click", function (event) {
          event.preventDefault();

          if (state.apiUnavailable) return;

          state.tripType = "oneway";
          resetReturnDateOnly();
          renderTripType();
        });
      }

      if (els.originField) {
        els.originField.addEventListener("click", handleOriginClick);
      }

      if (els.destinationField) {
        els.destinationField.addEventListener("click", handleDestinationClick);
      }

      if (els.departureField) {
        els.departureField.addEventListener("click", handleDepartureDateClick);
      }

      if (els.returnField) {
        els.returnField.addEventListener("click", handleReturnDateClick);
      }

      if (els.submit) {
        els.submit.addEventListener("click", handleSubmit);
      }

      document.addEventListener("click", function (event) {
        if (!state.openPanel) return;

        const clickedInsideOpenPanel = state.openPanel.contains(event.target);

        const clickedField =
          event.target.closest('[data-booking-field="origin"]') ||
          event.target.closest('[data-booking-field="destination"]') ||
          event.target.closest('[data-booking-field="departure-date"]') ||
          event.target.closest('[data-booking-field="return-date"]');

        if (clickedInsideOpenPanel || clickedField) return;

        closeAllPanels();
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeAllPanels();
        }
      });
    }

    function init() {
      captureUrlParamsForLater();
      injectCursorStyles();

      preparePanel(els.originDropdown);
      preparePanel(els.destinationDropdown);
      preparePanel(els.departureOverlay);
      preparePanel(els.returnOverlay);

      prepareCalendarTarget(els.departureCalendar);
      prepareCalendarTarget(els.returnCalendar);

      state.calendarTemplates.departure = captureCalendarTemplate("departure");
      state.calendarTemplates.return = captureCalendarTemplate("return");

      hideError();
      hideFallback();

      resetDestination();
      resetDates();

      const currentPassengerValue = parseInt(
        els.passengerValue ? els.passengerValue.textContent.trim() : "",
        10
      );

      if (Number.isFinite(currentPassengerValue)) {
        state.passengers = Math.min(
          Math.max(currentPassengerValue, CONFIG.minPassengers),
          CONFIG.maxPassengers
        );
      }

      bindEvents();
      renderPassengers();
      renderTripType();

      window.TwilinerBookingWidgetDebug = {
        config: CONFIG,
        state,
        elements: els,
        loadDeparturePlaces,
        loadDestinationPlaces,
        loadDepartureDates,
        loadReturnDates,
        drawCalendar,
        validateSelection,
        buildTurnitUrl,
        buildFallbackUrl,
        readStoredUrlParams,
        inspectTurnitPayload,
        getStatus,
        simulateFallback,
        simulateApiFailureOnce,
        activateFallbackMode
      };
    }

    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTwilinerBookingWidget);
  } else {
    initTwilinerBookingWidget();
  }
})();




/* ==========================================================================
   Twiliner Destination Route Selector
   v31 / D10 City Station Data + Modal Prefill
   - Laedt Destination + moegliche Abfahrtsorte via API
   - Rendert Origin-Items dynamisch
   - Liest Bahnhofdaten aus versteckter CMS City Data List
   - Befuellt Origin- und Destination-Links mit Bahnhofname + Maps URL
   - Nutzt State-Klassen statt manueller rechter Hoehen-/Transform-Logik
   - Kein translateY fuer Icon/Destination
   - Klick auf selected Origin oeffnet Liste wieder
   - Klick auf Address-/Map-Link oeffnet nicht die Liste
   - Hover-State nur auf Origin-Name, nicht beim Hover ueber Address-Link
   - Mobile: frueherer Scroll-Trigger
   - Button:
     - ohne bewusst gewaehlten Origin: Modal leer
     - mit bewusst gewaehltem Origin: Modal mit Origin + Destination
   - Dummy-Inhalte bleiben verborgen, bis echte Daten geladen sind
   ========================================================================== */

(function () {
  function initTwilinerDestinationRouteSelector() {
    const root = document.querySelector('[data-booking-destination-route="true"]');
    if (!root) return;

    const CONFIG = {
      apiBaseUrl: "https://data.nightride.com/api",
      operatorId: "a0cf1341-a01b-449d-b91f-17a1b4f84c44",
      apiTimeoutMs: 10000,
      selectedTextColor: "#46288c",
      hoverTextColor: "#eb8096",
      placeholderColor: "",
      breakpointMobile: 767,
      itemTransitionMs: 860,
      detailTransitionMs: 760,
      desktopObserverThreshold: 0.68,
      mobileObserverThreshold: 0.34
    };

    const API_LANGUAGE_MAP = {
      de: "de",
      en: "en"
    };

    const TEXT = {
      de: {
        choose: "Bitte wählen"
      },
      en: {
        choose: "Please select"
      }
    };

    const LEGACY_CITY_CODE_MAP = {
      zurich: "001",
      zuerich: "001",
      zurigo: "001",
      bern: "002",
      berne: "002",
      basel: "012",
      girona: "004",
      barcelona: "005",
      amsterdam: "006",
      rotterdam: "008",
      brussels: "009",
      brussel: "009",
      bruxelles: "009",
      luxembourg: "010",
      luxemburg: "010"
    };

    const TURNIT_CITY_NAME_BY_LEGACY_CODE = {
      "001": "Zurich",
      "002": "Bern",
      "012": "Basel",
      "004": "Girona",
      "005": "Barcelona",
      "006": "Amsterdam",
      "008": "Rotterdam",
      "009": "Brussels",
      "010": "Luxembourg"
    };

    const routeState = {
      language: getCurrentLanguage(),
      currentDestinationApiId: (root.getAttribute("data-booking-current-destination-api-id") || "").trim(),

      currentDestination: null,
      selectedOrigin: null,

      allDeparturePlaces: [],
      availableOrigins: [],

      cityDataByApiId: new Map(),

      isLoading: false,
      isLoaded: false,
      isExpanded: false,
      hasUserSelectedOrigin: false,

      lastModalPrefillMode: null,

      error: null,
      observer: null
    };

    const els = {
      cascader: root.querySelector(".cascader-wrapper") || root,

      originList: root.querySelector('[data-booking-destination-origin-list="true"]'),
      originTemplate: root.querySelector('[data-booking-destination-origin-template="true"]'),

      destinationWrapper: root.querySelector('[data-booking-destination-target-wrapper="true"]'),
      destinationLabel: root.querySelector('[data-booking-destination-label-target="true"]'),
      destinationAddress: root.querySelector('[data-booking-destination-address-target="true"]'),
      destinationMap: root.querySelector('[data-booking-destination-map-target="true"]'),

      iconWrapper: root.querySelector('[data-booking-destination-icon-wrapper="true"]'),
      icon: root.querySelector('[data-booking-destination-icon="true"]'),

      submit: root.querySelector('[data-booking-destination-submit="true"]')
    };

    const templateClone = els.originTemplate ? els.originTemplate.cloneNode(true) : null;

    function getCurrentLanguage() {
      const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();

      if (htmlLang.startsWith("en")) return "en";
      if (htmlLang.startsWith("de")) return "de";

      const path = window.location.pathname.toLowerCase();
      if (path === "/en" || path.startsWith("/en/")) return "en";

      return "de";
    }

    function getLabels() {
      return TEXT[routeState.language] || TEXT.de;
    }

    function isMobile() {
      return window.matchMedia("(max-width: " + CONFIG.breakpointMobile + "px)").matches;
    }

    function normalizeLookupKey(input) {
      return String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function stripTrailingCountryCode(label) {
      return String(label || "").replace(/\s*\([A-Z]{2}\)\s*$/, "");
    }

    function getLegacyCodeForPlace(place, cleanedLabel) {
      const lookupKeys = [
        normalizeLookupKey(cleanedLabel),
        normalizeLookupKey(place.label),
        normalizeLookupKey(place.name),
        normalizeLookupKey(place.name_de),
        normalizeLookupKey(place.name_en),
        normalizeLookupKey(place.name_fr),
        normalizeLookupKey(place.key)
      ].filter(Boolean);

      for (let i = 0; i < lookupKeys.length; i += 1) {
        if (LEGACY_CITY_CODE_MAP[lookupKeys[i]]) {
          return LEGACY_CITY_CODE_MAP[lookupKeys[i]];
        }
      }

      return null;
    }

    function getTurnitCityName(place, cleanedLabel, legacyCode) {
      if (legacyCode && TURNIT_CITY_NAME_BY_LEGACY_CODE[legacyCode]) {
        return TURNIT_CITY_NAME_BY_LEGACY_CODE[legacyCode];
      }

      return (
        place.name_en ||
        place.key ||
        place.name ||
        cleanedLabel ||
        place.label ||
        ""
      );
    }

    function mapPlace(place) {
      const cleanedLabel = stripTrailingCountryCode(place.label);
      const legacyCode = getLegacyCodeForPlace(place, cleanedLabel);
      const turnitCityName = getTurnitCityName(place, cleanedLabel, legacyCode);

      return {
        value: legacyCode || place.id,
        apiId: place.id,
        label: cleanedLabel || place.label || place.name || "",
        cityName: place.name || cleanedLabel || place.label || "",
        turnitLabel: turnitCityName,
        turnitCityName: turnitCityName,
        raw: place
      };
    }

    function sortPlacesAlphabetically(places) {
      return places.slice().sort(function (a, b) {
        return String(a.label || "").localeCompare(String(b.label || ""), routeState.language, {
          sensitivity: "base"
        });
      });
    }

    function makeApiError(stage, message, url, status, originalError) {
      return {
        stage: stage || "unknown",
        message: message || "Unknown API error",
        url: url || null,
        status: status || null,
        timestamp: new Date().toISOString(),
        originalErrorName: originalError && originalError.name ? originalError.name : null
      };
    }

    async function apiGet(path, query, stage) {
      const url = new URL(
        CONFIG.apiBaseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "")
      );

      Object.keys(query || {}).forEach(function (key) {
        const value = query[key];

        if (value !== null && value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      });

      const urlString = url.toString();

      const controller = new AbortController();
      const timeout = window.setTimeout(function () {
        controller.abort();
      }, CONFIG.apiTimeoutMs);

      try {
        const response = await fetch(urlString, {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw makeApiError(stage, "HTTP " + response.status, urlString, response.status, null);
        }

        return await response.json();
      } catch (error) {
        if (error && error.stage && error.message && error.url) {
          throw error;
        }

        if (error && error.name === "AbortError") {
          throw makeApiError(
            stage,
            "API timeout after " + (CONFIG.apiTimeoutMs / 1000) + "s",
            urlString,
            null,
            error
          );
        }

        throw makeApiError(
          stage,
          error && error.message ? error.message : "Network/API error",
          urlString,
          null,
          error
        );
      } finally {
        window.clearTimeout(timeout);
      }
    }

    function uniqueElements(elements) {
      return elements.filter(Boolean).filter(function (el, index, array) {
        return array.indexOf(el) === index;
      });
    }

    function readCityData() {
      routeState.cityDataByApiId.clear();

      document.querySelectorAll('[data-booking-city-item="true"]').forEach(function (item) {
        const apiId = (item.getAttribute("data-booking-city-api-id") || "").trim();
        const stationNameEl = item.querySelector('[data-booking-city-station-name="true"]');
        const mapUrlEl = item.querySelector('[data-booking-city-map-url="true"]');

        const stationName = stationNameEl ? stationNameEl.textContent.trim() : "";
        const mapUrl = mapUrlEl ? (mapUrlEl.getAttribute("href") || "").trim() : "";

        if (!apiId) return;

        routeState.cityDataByApiId.set(apiId, {
          apiId: apiId,
          stationName: stationName,
          mapUrl: mapUrl && mapUrl !== "#" ? mapUrl : ""
        });
      });
    }

    function getCityData(apiId) {
      if (!apiId) return null;
      return routeState.cityDataByApiId.get(apiId) || null;
    }

    function applyStationLinkToElements(elements, cityData) {
      const detailEls = uniqueElements(elements);

      detailEls.forEach(function (el) {
        if (!el) return;

        const stationName = cityData && cityData.stationName ? cityData.stationName : "";
        const mapUrl = cityData && cityData.mapUrl ? cityData.mapUrl : "";

        el.textContent = stationName;

        if (el.tagName === "A") {
          el.setAttribute("href", mapUrl || "#");

          if (mapUrl) {
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener noreferrer");
            el.setAttribute("aria-label", stationName || "Google Maps");
          } else {
            el.removeAttribute("target");
            el.removeAttribute("rel");
            el.removeAttribute("aria-label");
          }
        }

        el.classList.toggle("has-city-data", Boolean(stationName || mapUrl));
      });
    }

    function applyCityDataToOriginItem(item, place) {
      if (!item || !place) return;

      const cityData = getCityData(place.apiId);

      const detailEls = uniqueElements([
        item.querySelector('[data-booking-destination-origin-address="true"]'),
        item.querySelector('[data-booking-destination-origin-map="true"]')
      ]);

      applyStationLinkToElements(detailEls, cityData);
    }

    function applyCityDataToDestination() {
      if (!routeState.currentDestination) return;

      const cityData = getCityData(routeState.currentDestination.apiId);

      const detailEls = uniqueElements([
        els.destinationAddress,
        els.destinationMap
      ]);

      applyStationLinkToElements(detailEls, cityData);
    }

    function resetInlineStyles() {
      const elementsToClean = uniqueElements([
        els.originList,
        els.iconWrapper,
        els.destinationWrapper,
        els.destinationLabel,
        els.destinationAddress,
        els.destinationMap,
        root.querySelector(".cascading-text-positioner"),
        root.querySelector('[data-booking-destination-target-item="true"]')
      ]);

      elementsToClean.forEach(function (el) {
        [
          "overflow",
          "transition",
          "willChange",
          "maxHeight",
          "height",
          "minHeight",
          "transform",
          "opacity",
          "pointerEvents",
          "display",
          "alignItems"
        ].forEach(function (prop) {
          el.style[prop] = "";
        });
      });

      root.querySelectorAll('[data-booking-destination-origin-rendered="true"]').forEach(function (item) {
        [
          "overflow",
          "transition",
          "willChange",
          "maxHeight",
          "height",
          "minHeight",
          "transform",
          "opacity",
          "pointerEvents",
          "display"
        ].forEach(function (prop) {
          item.style[prop] = "";
        });

        const nameEl = item.querySelector('[data-booking-destination-origin-name="true"]');
        if (nameEl) {
          nameEl.style.color = "";
          nameEl.style.transition = "";
        }

        item.querySelectorAll(".cascading-address").forEach(function (addressEl) {
          [
            "overflow",
            "transition",
            "maxHeight",
            "height",
            "transform",
            "opacity",
            "pointerEvents",
            "display"
          ].forEach(function (prop) {
            addressEl.style[prop] = "";
          });
        });
      });
    }

    function injectStateStyles() {
      const oldStyle = document.getElementById("twiliner-destination-route-state-styles");
      if (oldStyle) oldStyle.remove();

      const style = document.createElement("style");
      style.id = "twiliner-destination-route-state-styles";

      style.textContent = `
        [data-booking-destination-route="true"] .cascader-wrapper {
          --tw-destination-primary: ${CONFIG.selectedTextColor};
          --tw-destination-hover: ${CONFIG.hoverTextColor};
          --tw-route-ease: cubic-bezier(0.22, 1, 0.36, 1);
          --tw-route-ease-soft: cubic-bezier(0.16, 1, 0.3, 1);
          opacity: 0;
          pointer-events: none;
          transition: opacity 320ms ease-in-out;
        }

        [data-booking-destination-route="true"] .cascader-wrapper.is-loaded {
          opacity: 1;
          pointer-events: auto;
        }

        [data-booking-destination-route="true"] .cascading-text-list {
          overflow: hidden;
        }

        [data-booking-destination-route="true"] .cascading-text-item {
          overflow: hidden;
          transition:
            opacity ${CONFIG.itemTransitionMs}ms var(--tw-route-ease),
            transform ${CONFIG.itemTransitionMs}ms var(--tw-route-ease),
            max-height ${CONFIG.itemTransitionMs}ms var(--tw-route-ease-soft);
          will-change: opacity, transform, max-height;
        }

        [data-booking-destination-route="true"] .cascading-text-item [data-booking-destination-origin-name="true"],
        [data-booking-destination-route="true"] [data-booking-destination-label-target="true"] {
          color: var(--tw-destination-primary);
          transition: color 240ms ease-in-out;
        }

        [data-booking-destination-route="true"] .cascading-address {
          display: block;
          overflow: hidden;
          opacity: 0;
          transform: translateY(-0.28rem);
          max-height: 0;
          pointer-events: none;
          transition:
            opacity ${CONFIG.detailTransitionMs}ms var(--tw-route-ease),
            transform ${CONFIG.detailTransitionMs}ms var(--tw-route-ease),
            max-height ${CONFIG.detailTransitionMs}ms var(--tw-route-ease-soft);
        }

        [data-booking-destination-route="true"] .cascader-wrapper:not(.is-expanded) [data-booking-destination-origin-rendered="true"]:not(.is-selected) {
          opacity: 0;
          transform: translateY(-0.38rem);
          max-height: 0;
          pointer-events: none;
        }

        [data-booking-destination-route="true"] .cascader-wrapper:not(.is-expanded) [data-booking-destination-origin-rendered="true"].is-selected {
          opacity: 1;
          transform: translateY(0);
          max-height: 24rem;
          pointer-events: auto;
        }

        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"] {
          opacity: 1;
          transform: translateY(0);
          max-height: 24rem;
          pointer-events: auto;
        }

        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(1) { transition-delay: 0ms; }
        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(2) { transition-delay: 45ms; }
        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(3) { transition-delay: 90ms; }
        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(4) { transition-delay: 135ms; }
        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(5) { transition-delay: 180ms; }
        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(6) { transition-delay: 225ms; }
        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(7) { transition-delay: 270ms; }
        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(8) { transition-delay: 315ms; }
        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"]:nth-child(9) { transition-delay: 360ms; }

        [data-booking-destination-route="true"] .cascader-wrapper.has-selection:not(.is-expanded) [data-booking-destination-origin-rendered="true"].is-selected .cascading-address.has-city-data,
        [data-booking-destination-route="true"] .cascader-wrapper.has-selection:not(.is-expanded) [data-booking-destination-target-wrapper="true"] .cascading-address.has-city-data {
          opacity: 1;
          transform: translateY(0);
          max-height: 8rem;
          pointer-events: auto;
          transition-delay: 320ms;
        }

        [data-booking-destination-route="true"] .cascader-wrapper.is-expanded .cascading-address {
          transition-delay: 0ms;
        }

        [data-booking-destination-route="true"] [data-booking-destination-target-wrapper="true"] {
          pointer-events: none;
        }

        [data-booking-destination-route="true"] [data-booking-destination-map-target="true"],
        [data-booking-destination-route="true"] [data-booking-destination-origin-map="true"] {
          pointer-events: auto;
        }

        @media screen and (min-width: 768px) {
          [data-booking-destination-route="true"] .cascading-text-item.is-name-hover [data-booking-destination-origin-name="true"] {
            color: var(--tw-destination-hover) !important;
          }

          [data-booking-destination-route="true"] [data-booking-destination-target-wrapper="true"] .cascading-text-item.is-name-hover [data-booking-destination-label-target="true"] {
            color: var(--tw-destination-primary) !important;
          }
        }

        @media screen and (max-width: 767px) {
          [data-booking-destination-route="true"] .cascader-wrapper.is-expanded [data-booking-destination-origin-rendered="true"] {
            transition-delay: 0ms;
            max-height: 40rem;
          }

          [data-booking-destination-route="true"] .cascader-wrapper.has-selection:not(.is-expanded) [data-booking-destination-origin-rendered="true"].is-selected .cascading-address.has-city-data,
          [data-booking-destination-route="true"] .cascader-wrapper.has-selection:not(.is-expanded) [data-booking-destination-target-wrapper="true"] .cascading-address.has-city-data {
            transition-delay: 220ms;
          }
        }
      `;

      document.head.appendChild(style);
    }

    function setRouteState(nextExpanded, nextHasSelection) {
      routeState.isExpanded = Boolean(nextExpanded);
      routeState.hasUserSelectedOrigin = Boolean(nextHasSelection);
      setCascaderState();
    }

    function setCascaderState() {
      if (!els.cascader) return;

      els.cascader.classList.toggle("is-expanded", routeState.isExpanded);
      els.cascader.classList.toggle("has-selection", routeState.hasUserSelectedOrigin);
      els.cascader.classList.toggle("is-loaded", routeState.isLoaded);
    }

    function setDestinationLabel() {
      if (!els.destinationLabel || !routeState.currentDestination) return;
      els.destinationLabel.textContent = routeState.currentDestination.label;
    }

    function clearGeneratedOriginList() {
      if (!els.originList) return;
      els.originList.innerHTML = "";
    }

    function createFallbackOriginItem() {
      const item = document.createElement("div");
      item.className = "cascading-text-item";

      const nameEl = document.createElement("div");
      nameEl.className = "cascading-text";
      nameEl.setAttribute("data-booking-destination-origin-name", "true");

      const addressEl = document.createElement("a");
      addressEl.className = "cascading-address";
      addressEl.setAttribute("data-booking-destination-origin-address", "true");
      addressEl.setAttribute("data-booking-destination-origin-map", "true");
      addressEl.setAttribute("href", "#");

      item.appendChild(nameEl);
      item.appendChild(addressEl);

      return item;
    }

    function createOriginItem(place, index) {
      const item = templateClone ? templateClone.cloneNode(true) : createFallbackOriginItem();

      item.removeAttribute("data-booking-destination-origin-template");
      item.setAttribute("data-booking-destination-origin-rendered", "true");
      item.setAttribute("data-booking-destination-origin-api-id", place.apiId);
      item.setAttribute("data-booking-destination-origin-index", String(index));
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");

      item.classList.remove("is-selected", "is-name-hover");

      const nameEl = item.querySelector('[data-booking-destination-origin-name="true"]');
      const mapEls = uniqueElements([
        item.querySelector('[data-booking-destination-origin-address="true"]'),
        item.querySelector('[data-booking-destination-origin-map="true"]')
      ]);

      if (nameEl) {
        nameEl.textContent = place.label;

        nameEl.addEventListener("mouseenter", function () {
          if (isMobile()) return;
          item.classList.add("is-name-hover");
        });

        nameEl.addEventListener("mouseleave", function () {
          item.classList.remove("is-name-hover");
        });
      }

      applyCityDataToOriginItem(item, place);

      mapEls.forEach(function (mapEl) {
        mapEl.addEventListener("mouseenter", function () {
          item.classList.remove("is-name-hover");
        });

        mapEl.addEventListener("click", function (event) {
          event.stopPropagation();

          const href = mapEl.getAttribute("href") || "";
          if (!href || href === "#") {
            event.preventDefault();
          }
        });
      });

      item.addEventListener("click", function (event) {
        event.preventDefault();

        const clickedMap = event.target.closest('[data-booking-destination-origin-map="true"], [data-booking-destination-origin-address="true"]');
        if (clickedMap) return;

        const clickedName = event.target.closest('[data-booking-destination-origin-name="true"]');
        const isSelected = routeState.selectedOrigin && routeState.selectedOrigin.apiId === place.apiId;

        if (isSelected && !routeState.isExpanded && clickedName) {
          setRouteState(true, false);
          return;
        }

        routeState.selectedOrigin = place;
        updateSelectedOriginVisual();
        setRouteState(false, true);
      });

      item.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();

        const isSelected = routeState.selectedOrigin && routeState.selectedOrigin.apiId === place.apiId;

        if (isSelected && !routeState.isExpanded) {
          setRouteState(true, false);
          return;
        }

        routeState.selectedOrigin = place;
        updateSelectedOriginVisual();
        setRouteState(false, true);
      });

      return item;
    }

    function renderOriginList() {
      if (!els.originList) return;

      clearGeneratedOriginList();

      routeState.availableOrigins.forEach(function (place, index) {
        els.originList.appendChild(createOriginItem(place, index));
      });

      updateSelectedOriginVisual();

      window.requestAnimationFrame(function () {
        setCascaderState();
      });
    }

    function getRenderedOriginItems() {
      if (!els.originList) return [];

      return Array.from(
        els.originList.querySelectorAll('[data-booking-destination-origin-rendered="true"]')
      );
    }

    function updateSelectedOriginVisual() {
      getRenderedOriginItems().forEach(function (item) {
        const isSelected =
          routeState.selectedOrigin &&
          item.getAttribute("data-booking-destination-origin-api-id") === routeState.selectedOrigin.apiId;

        item.classList.toggle("is-selected", Boolean(isSelected));
        item.setAttribute("aria-selected", isSelected ? "true" : "false");
      });
    }

    function setModalLabel(el, value) {
      if (!el) return;

      el.textContent = value || getLabels().choose;

      if (value) {
        el.style.color = CONFIG.selectedTextColor;
      } else {
        el.style.color = CONFIG.placeholderColor;
      }
    }

    function clearMapOrSet(target, source) {
      if (!target) return source;

      if (target instanceof Map) {
        target.clear();
        return target;
      }

      if (target instanceof Set) {
        target.clear();
        return target;
      }

      return source;
    }

    function resetModalToEmpty() {
      const debug = window.TwilinerBookingWidgetDebug || {};
      const modalState = debug.state;
      const modalEls = debug.elements;

      if (!modalState || !modalEls) return false;

      modalState.selectedOrigin = null;
      modalState.selectedDestination = null;
      modalState.selectedDepartureDate = null;
      modalState.selectedReturnDate = null;

      modalState.destinationPlaces = [];
      modalState.destinationLoaded = false;
      modalState.departureDatesLoaded = false;
      modalState.returnDatesLoaded = false;

      modalState.departureDates = clearMapOrSet(modalState.departureDates, new Set());
      modalState.returnDates = clearMapOrSet(modalState.returnDates, new Set());
      modalState.departurePrices = clearMapOrSet(modalState.departurePrices, new Map());
      modalState.returnPrices = clearMapOrSet(modalState.returnPrices, new Map());
      modalState.departureCheapDates = clearMapOrSet(modalState.departureCheapDates, new Set());
      modalState.returnCheapDates = clearMapOrSet(modalState.returnCheapDates, new Set());

      modalState.openPanel = null;

      setModalLabel(modalEls.originLabel, null);
      setModalLabel(modalEls.destinationLabel, null);
      setModalLabel(modalEls.departureLabel, null);
      setModalLabel(modalEls.returnLabel, null);

      if (modalEls.error) {
        modalEls.error.textContent = "";
        modalEls.error.style.display = "none";
      }

      if (modalEls.departureField) {
        modalEls.departureField.style.pointerEvents = "";
        modalEls.departureField.style.opacity = "";
      }

      if (modalEls.returnField) {
        modalEls.returnField.style.pointerEvents = "";
        modalEls.returnField.style.opacity = "";
      }

      if (typeof debug.drawCalendar === "function") {
        try {
          debug.drawCalendar("departure");
          debug.drawCalendar("return");
        } catch (_) {
          // Ignore calendar redraw issues during empty reset.
        }
      }

      return true;
    }

    async function prefillModalWithSelectedRoute() {
      const debug = window.TwilinerBookingWidgetDebug || {};
      const modalState = debug.state;
      const modalEls = debug.elements;

      if (!modalState || !modalEls) return false;
      if (!routeState.hasUserSelectedOrigin || !routeState.selectedOrigin || !routeState.currentDestination) {
        return resetModalToEmpty();
      }

      resetModalToEmpty();

      modalState.selectedOrigin = routeState.selectedOrigin;
      modalState.selectedDestination = routeState.currentDestination;

      setModalLabel(modalEls.originLabel, routeState.selectedOrigin.label);
      setModalLabel(modalEls.destinationLabel, routeState.currentDestination.label);

      if (modalEls.error) {
        modalEls.error.textContent = "";
        modalEls.error.style.display = "none";
      }

      routeState.lastModalPrefillMode = "origin-destination";

      try {
        if (typeof debug.loadDestinationPlaces === "function") {
          await debug.loadDestinationPlaces();
        }

        modalState.selectedDestination = routeState.currentDestination;
        setModalLabel(modalEls.destinationLabel, routeState.currentDestination.label);

        if (typeof debug.loadDepartureDates === "function") {
          await debug.loadDepartureDates();
        }
      } catch (error) {
        console.warn("Twiliner destination route modal prefill failed:", error);
      }

      return true;
    }

    function handleSubmitClick(event) {
      event.preventDefault();

      if (!routeState.hasUserSelectedOrigin) {
        routeState.lastModalPrefillMode = "empty";
        resetModalToEmpty();
        return;
      }

      prefillModalWithSelectedRoute();
    }

    function isArrivalAvailableForDestination(arrivalPayload) {
      if (!Array.isArray(arrivalPayload)) return false;

      return arrivalPayload.some(function (place) {
        return place && place.id === routeState.currentDestinationApiId;
      });
    }

    async function loadAvailableOriginsForCurrentDestination() {
      const apiLanguage = API_LANGUAGE_MAP[routeState.language] || "de";

      const departuresPayload = await apiGet("get-places", {
        type: "departure",
        language: apiLanguage,
        operator_id: CONFIG.operatorId
      }, "destination-route-departure-places");

      const allDepartures = Array.isArray(departuresPayload)
        ? departuresPayload.map(mapPlace).filter(function (place) {
            return Boolean(place.label && place.apiId);
          })
        : [];

      routeState.allDeparturePlaces = sortPlacesAlphabetically(allDepartures);

      routeState.currentDestination = routeState.allDeparturePlaces.find(function (place) {
        return place.apiId === routeState.currentDestinationApiId;
      }) || null;

      if (!routeState.currentDestination) {
        throw makeApiError(
          "destination-route-current-destination",
          "Current destination API ID was not found in API places.",
          null,
          null,
          null
        );
      }

      const results = await Promise.all(
        routeState.allDeparturePlaces.map(async function (departurePlace) {
          if (departurePlace.apiId === routeState.currentDestinationApiId) {
            return null;
          }

          try {
            const arrivalPayload = await apiGet("get-places", {
              type: "arrival",
              language: apiLanguage,
              operator_id: CONFIG.operatorId,
              place_departure_id: departurePlace.apiId
            }, "destination-route-arrival-check");

            return isArrivalAvailableForDestination(arrivalPayload) ? departurePlace : null;
          } catch (error) {
            console.warn("Twiliner destination route arrival check failed:", {
              departurePlace,
              error
            });

            return null;
          }
        })
      );

      routeState.availableOrigins = sortPlacesAlphabetically(results.filter(Boolean));
      routeState.selectedOrigin = routeState.availableOrigins[0] || null;
    }

    async function loadDestinationRouteData() {
      if (routeState.isLoading || routeState.isLoaded) return;

      routeState.isLoading = true;
      routeState.error = null;

      try {
        if (!routeState.currentDestinationApiId) {
          throw makeApiError(
            "destination-route-missing-api-id",
            "Missing CMS Booking API Place ID.",
            null,
            null,
            null
          );
        }

        readCityData();
        await loadAvailableOriginsForCurrentDestination();

        setDestinationLabel();
        applyCityDataToDestination();
        renderOriginList();

        routeState.isLoaded = true;
        routeState.isExpanded = false;
        routeState.hasUserSelectedOrigin = false;
        routeState.lastModalPrefillMode = null;

        resetInlineStyles();
        setCascaderState();
        updateSelectedOriginVisual();
        initObserver();

        if (els.submit) {
          els.submit.addEventListener("click", handleSubmitClick);
        }
      } catch (error) {
        console.error("Twiliner destination route error:", error);
        routeState.error = error;
      } finally {
        routeState.isLoading = false;
      }
    }

    function initObserver() {
      if (!("IntersectionObserver" in window)) return;
      if (routeState.observer) routeState.observer.disconnect();

      const threshold = isMobile()
        ? CONFIG.mobileObserverThreshold
        : CONFIG.desktopObserverThreshold;

      const rootMargin = isMobile()
        ? "0px 0px -8% 0px"
        : "0px 0px -24% 0px";

      routeState.observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (entry.intersectionRatio < threshold) return;
          if (routeState.hasUserSelectedOrigin) return;
          if (routeState.isExpanded) return;

          setRouteState(true, false);
        });
      }, {
        root: null,
        rootMargin,
        threshold: [0, 0.25, threshold, 0.85, 1]
      });

      routeState.observer.observe(root);
    }

    function getDestinationRouteStatus() {
      const selectedOriginCityData = routeState.selectedOrigin
        ? getCityData(routeState.selectedOrigin.apiId)
        : null;

      const currentDestinationCityData = routeState.currentDestination
        ? getCityData(routeState.currentDestination.apiId)
        : null;

      const nextSubmitPrefill = routeState.hasUserSelectedOrigin && routeState.selectedOrigin && routeState.currentDestination
        ? {
            mode: "origin-destination",
            origin: routeState.selectedOrigin,
            destination: routeState.currentDestination
          }
        : {
            mode: "empty",
            origin: null,
            destination: null
          };

      return {
        language: routeState.language,
        currentDestinationApiId: routeState.currentDestinationApiId,

        currentDestination: routeState.currentDestination,
        selectedOrigin: routeState.selectedOrigin,

        selectedOriginCityData: selectedOriginCityData,
        currentDestinationCityData: currentDestinationCityData,
        cityDataCount: routeState.cityDataByApiId.size,

        allDeparturePlacesCount: routeState.allDeparturePlaces.length,
        availableOriginsCount: routeState.availableOrigins.length,

        availableOrigins: routeState.availableOrigins.map(function (place) {
          return {
            label: place.label,
            apiId: place.apiId,
            value: place.value,
            turnitLabel: place.turnitLabel,
            turnitCityName: place.turnitCityName,
            cityData: getCityData(place.apiId)
          };
        }),

        isLoading: routeState.isLoading,
        isLoaded: routeState.isLoaded,
        isExpanded: routeState.isExpanded,
        hasUserSelectedOrigin: routeState.hasUserSelectedOrigin,
        lastModalPrefillMode: routeState.lastModalPrefillMode,
        nextSubmitPrefill: nextSubmitPrefill,

        error: routeState.error,

        elements: {
          root: Boolean(root),
          cascader: Boolean(els.cascader),
          originList: Boolean(els.originList),
          originTemplate: Boolean(els.originTemplate),
          destinationLabel: Boolean(els.destinationLabel),
          destinationWrapper: Boolean(els.destinationWrapper),
          destinationAddress: Boolean(els.destinationAddress),
          destinationMap: Boolean(els.destinationMap),
          iconWrapper: Boolean(els.iconWrapper),
          icon: Boolean(els.icon),
          submit: Boolean(els.submit)
        }
      };
    }

    function init() {
      injectStateStyles();

      window.TwilinerBookingWidgetDebug = Object.assign(
        window.TwilinerBookingWidgetDebug || {},
        {
          destinationRouteState: routeState,
          destinationRouteElements: els,
          getDestinationRouteStatus,
          expandDestinationRoute: function () {
            setRouteState(true, false);
          },
          collapseDestinationRoute: function () {
            setRouteState(false, true);
          },
          prefillModalFromDestinationRoute: prefillModalWithSelectedRoute,
          resetModalFromDestinationRoute: resetModalToEmpty,
          reloadDestinationRouteData: function () {
            routeState.isLoaded = false;
            routeState.isExpanded = false;
            routeState.hasUserSelectedOrigin = false;
            return loadDestinationRouteData();
          }
        }
      );

      loadDestinationRouteData();
    }

    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTwilinerDestinationRouteSelector);
  } else {
    initTwilinerDestinationRouteSelector();
  }
})();
