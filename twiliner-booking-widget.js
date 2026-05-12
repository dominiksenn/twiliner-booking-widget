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
     */

    const CONFIG = {
      apiBaseUrl: "https://data.nightride.com/api",
      bookingBaseUrl: "https://booking.twiliner.com/",
      operatorId: "a0cf1341-a01b-449d-b91f-17a1b4f84c44",
      currency: "CHF",
      minPassengers: 1,
      maxPassengers: 9,
      panelTransitionMs: 300,
      selectedTextColor: "#46288c"
    };

    const TEXT = {
      de: {
        choose: "Bitte wählen",
        chooseDate: "Datum",
        loading: "Wird geladen...",
        noDepartures: "Keine Abfahrtsorte verfügbar",
        noDestinations: "Keine Ankunftsorte verfügbar",
        noDates: "Keine verfügbaren Reisedaten.",
        selectOriginFirst: "Bitte zuerst einen Abfahrtsort wählen.",
        selectDestinationFirst: "Bitte zuerst einen Ankunftsort wählen.",
        originApiError: "Die Abfahrtsorte konnten nicht geladen werden.",
        destinationApiError: "Die Ankunftsorte konnten nicht geladen werden.",
        datesApiError: "Die Reisedaten konnten nicht geladen werden.",
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
        selectOriginFirst: "Please select a departure place first.",
        selectDestinationFirst: "Please select an arrival place first.",
        originApiError: "Departure places could not be loaded.",
        destinationApiError: "Arrival places could not be loaded.",
        datesApiError: "Travel dates could not be loaded.",
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
      bern: "002",
      berne: "002",
      basel: "012",
      girona: "004",
      barcelona: "005",
      amsterdam: "006",
      rotterdam: "008",
      brussels: "009",
      luxembourg: "010"
    };

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

      isLoadingOrigins: false,
      isLoadingDestinations: false,
      isLoadingDepartureDates: false,

      originLoaded: false,
      destinationLoaded: false,
      departureDatesLoaded: false,

      viewDates: {
        departure: new Date()
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

    function formatSelectedDate(iso) {
      const date = parseIsoDate(iso);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");

      if (state.language === "en") {
        return day + " " + labels.monthsShort[date.getMonth()];
      }

      return day + "." + month + ".";
    }

    function formatPriceForCalendar(price) {
      const numeric = Number(price);

      if (!Number.isFinite(numeric)) return "";

      const francs = numeric >= 1000 ? numeric / 100 : numeric;
      const rounded = Math.round(francs);

      return String(rounded) + ".–";
    }

    function mapPlace(place) {
      const cleanedLabel = stripTrailingCountryCode(place.label);
      const lookupKeys = [
        normalizeLookupKey(cleanedLabel),
        normalizeLookupKey(place.name),
        normalizeLookupKey(place.key)
      ].filter(Boolean);

      let legacyCode = null;

      for (let i = 0; i < lookupKeys.length; i += 1) {
        if (LEGACY_CITY_CODE_MAP[lookupKeys[i]]) {
          legacyCode = LEGACY_CITY_CODE_MAP[lookupKeys[i]];
          break;
        }
      }

      return {
        value: legacyCode || place.id,
        apiId: place.id,
        label: cleanedLabel || place.label || place.name || "",
        cityName: place.name || cleanedLabel || place.label || "",
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

    async function apiGet(path, query) {
      const url = new URL(
        CONFIG.apiBaseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "")
      );

      Object.keys(query || {}).forEach(function (key) {
        const value = query[key];

        if (value !== null && value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      });

      const controller = new AbortController();
      const timeout = window.setTimeout(function () {
        controller.abort();
      }, 10000);

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        return await response.json();
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
      if (!panel) return;

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
      if (!panel) return;

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
      if (!field) return;

      field.style.opacity = isLoading ? "0.6" : "";
      field.style.pointerEvents = isLoading ? "none" : "";
    }

    function setFieldEnabled(field, isEnabled) {
      if (!field) return;

      field.style.opacity = isEnabled ? "" : "0.4";
      field.style.pointerEvents = isEnabled ? "" : "none";
      field.setAttribute("aria-disabled", isEnabled ? "false" : "true");
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

    function showFallback() {
      if (!els.fallback) return;

      els.fallback.textContent = labels.directBooking;
      els.fallback.style.display = "inline-block";
      els.fallback.setAttribute("href", CONFIG.bookingBaseUrl);
    }

    function hideFallback() {
      if (!els.fallback) return;

      els.fallback.style.display = "none";
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

      if (state.passengers >= CONFIG.maxPassengers) return;

      state.passengers += 1;
      renderPassengers();
    }

    function decreasePassengers(event) {
      if (event) event.preventDefault();

      if (state.passengers <= CONFIG.minPassengers) return;

      state.passengers -= 1;
      renderPassengers();
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

      widget.setAttribute("data-booking-trip-type", state.tripType);
    }

    function toggleTripType(event) {
      if (event) event.preventDefault();

      state.tripType = state.tripType === "roundtrip" ? "oneway" : "roundtrip";

      if (state.tripType === "oneway") {
        state.selectedReturnDate = null;
        setLabelPlaceholder(els.returnLabel, labels.chooseDate);
        closePanel(els.returnOverlay, true);
      }

      renderTripType();
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
          onSelect(option);
        });

        item.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
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

      setFieldEnabled(els.destinationField, false);
      closePanel(els.destinationDropdown, true);
    }

    function resetDates() {
      state.selectedDepartureDate = null;
      state.selectedReturnDate = null;
      state.departureDates = new Set();
      state.departurePrices = new Map();
      state.departureCheapDates = new Set();
      state.departureDatesLoaded = false;

      setLabelPlaceholder(els.departureLabel, labels.chooseDate);
      setLabelPlaceholder(els.returnLabel, labels.chooseDate);

      closePanel(els.departureOverlay, true);
      closePanel(els.returnOverlay, true);
    }

    async function setOrigin(origin) {
      state.selectedOrigin = origin;

      setLabelSelected(els.originLabel, origin.label);

      hideError();
      closePanel(els.originDropdown);

      resetDestination();
      resetDates();

      await loadDestinationPlaces();
    }

    async function setDestination(destination) {
      state.selectedDestination = destination;

      setLabelSelected(els.destinationLabel, destination.label);

      hideError();
      closePanel(els.destinationDropdown);

      resetDates();

      await loadDepartureDates();
    }

    async function loadDeparturePlaces() {
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
        });

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

        showError(labels.originApiError);
        showFallback();

        if (!state.selectedOrigin) {
          setLabelPlaceholder(els.originLabel, labels.choose);
        }
      } finally {
        state.isLoadingOrigins = false;
        setFieldLoading(els.originField, false);
      }
    }

    async function loadDestinationPlaces() {
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
        });

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
        setFieldEnabled(els.destinationField, state.destinationPlaces.length > 0);
      } catch (error) {
        console.error("Twiliner destination API error:", error);

        showError(labels.destinationApiError);
        showFallback();

        setLabelPlaceholder(els.destinationLabel, labels.choose);
        setFieldEnabled(els.destinationField, false);
      } finally {
        state.isLoadingDestinations = false;
        setFieldLoading(els.destinationField, false);

        if (!state.destinationPlaces.length) {
          setFieldEnabled(els.destinationField, false);
        }
      }
    }

    async function loadDepartureDates() {
      if (!state.selectedOrigin || !state.selectedDestination) return;

      state.isLoadingDepartureDates = true;
      state.departureDatesLoaded = false;

      setFieldLoading(els.departureField, true);

      try {
        const payload = await apiGet("get-connection-dates", {
          place_departure_id: state.selectedOrigin.apiId,
          place_arrival_id: state.selectedDestination.apiId,
          operator_id: CONFIG.operatorId,
          currency: CONFIG.currency
        });

        const dates = new Set();
        const prices = new Map();
        const cheapDates = new Set();

        if (Array.isArray(payload)) {
          payload.forEach(function (item) {
            if (!item || !item.date || !item.best_offer) return;

            const price = item.best_offer.price;

            if (price === null || price === undefined) return;

            dates.add(item.date);
            prices.set(item.date, formatPriceForCalendar(price));

            if (item.best_offer.cheap) {
              cheapDates.add(item.date);
            }
          });
        }

        state.departureDates = dates;
        state.departurePrices = prices;
        state.departureCheapDates = cheapDates;
        state.departureDatesLoaded = true;

        const firstAvailableDate = Array.from(dates).sort()[0];

        if (firstAvailableDate) {
          const date = parseIsoDate(firstAvailableDate);
          state.viewDates.departure = new Date(date.getFullYear(), date.getMonth(), 1);
        } else {
          const today = new Date();
          state.viewDates.departure = new Date(today.getFullYear(), today.getMonth(), 1);
        }

        drawCalendar("departure");
      } catch (error) {
        console.error("Twiliner departure dates API error:", error);

        showError(labels.datesApiError);
        showFallback();
      } finally {
        state.isLoadingDepartureDates = false;
        setFieldLoading(els.departureField, false);
      }
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
        navClass:
          calendar.querySelector(".booking-calendar-nav")?.className || "booking-calendar-nav",
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

    function drawCalendar(type) {
      if (type !== "departure") return;

      const calendar = els.departureCalendar;
      const template = state.calendarTemplates.departure;

      if (!calendar || !template) return;

      const content = clearAndCreateCalendarShell("departure");
      if (!content) return;

      const viewDate = state.viewDates.departure || new Date();
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();

      const header = createElement("div", template.headerClass);

      const prev = createElement("button", template.prevClass);
      prev.type = "button";
      prev.innerHTML = template.prevInner;
      prev.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        state.viewDates.departure = new Date(year, month - 1, 1);
        drawCalendar("departure");
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

        state.viewDates.departure = new Date(year, month + 1, 1);
        drawCalendar("departure");
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

      const cells = buildCalendarCells(year, month);
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

    function buildCalendarCells(year, month) {
      const template = state.calendarTemplates.departure;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstDay = new Date(year, month, 1);
      const firstDayIndex = firstDay.getDay();
      const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const cells = [];

      for (let i = 0; i < offset; i += 1) {
        const empty = createElement("div", template.dayClass + " is-empty");
        cells.push(empty);
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);

        const iso = formatIsoDate(date);
        const available = state.departureDates.has(iso);
        const selected = state.selectedDepartureDate === iso;
        const cheap = state.departureCheapDates.has(iso);
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

        const dateEl = createElement("div", dateElClasses.join(" "), String(day));
        const price = state.departurePrices.get(iso);
        const priceEl = createElement("div", priceElClasses.join(" "), price || "");

        dayEl.appendChild(dateEl);
        dayEl.appendChild(priceEl);

        if (available && !past) {
          dayEl.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            selectDepartureDate(iso);
          });
        } else {
          dayEl.disabled = true;
          dayEl.setAttribute("aria-disabled", "true");
        }

        cells.push(dayEl);
      }

      while (cells.length % 7 !== 0) {
        const empty = createElement("div", template.dayClass + " is-empty");
        cells.push(empty);
      }

      return cells;
    }

    function selectDepartureDate(iso) {
      state.selectedDepartureDate = iso;
      state.selectedReturnDate = null;

      setLabelSelected(els.departureLabel, formatSelectedDate(iso));
      setLabelPlaceholder(els.returnLabel, labels.chooseDate);

      drawCalendar("departure");
      closePanel(els.departureOverlay);
    }

    async function handleOriginClick(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

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
          state.tripType = "roundtrip";
          renderTripType();
        });
      }

      if (els.toggleOnewayLabel) {
        els.toggleOnewayLabel.addEventListener("click", function (event) {
          event.preventDefault();
          state.tripType = "oneway";
          state.selectedReturnDate = null;
          setLabelPlaceholder(els.returnLabel, labels.chooseDate);
          closePanel(els.returnOverlay, true);
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

      if (els.submit) {
        els.submit.addEventListener("click", function (event) {
          event.preventDefault();
        });
      }

      document.addEventListener("click", function (event) {
        if (!widget.contains(event.target)) {
          closeAllPanels();
        }
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeAllPanels();
        }
      });
    }

    function init() {
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
        drawCalendar
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
