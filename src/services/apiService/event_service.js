import { getRequest, postRequest, HEADER_TYPES } from "../api";
import ENDPOINTS from "../endpoints";
import ApiResponse from "../ApiResponse";

class EventService {
  // 🔹 Get all events (requires auth token)
  async getEvents() {
    try {
      const response = await getRequest(
        ENDPOINTS.GET_EVENT_LIST,
        HEADER_TYPES.AUTH // Bearer token header
      );

      // Handle the API response structure: {status: "success", events: [...]}
      if (response.status === "success" || response.code === 200) {
        // Extract the events data from response.data.events
        const events = response.data?.events || [];
        
        return new ApiResponse("success", response.code || 200, response.message || "Events fetched successfully", events);
      } else {
        return new ApiResponse("error", response.code || 500, response.message || "Failed to fetch events", []);
      }
    } catch (err) {
      return new ApiResponse("error", 500, err.message || "Fetching events failed", []);
    }
  }

  // 🔹 Get event details by ID (requires auth token)
  async getEventDetails(eventId) {
    try {
      const response = await getRequest(
        `${ENDPOINTS.GET_EVENT}/${eventId}`, 
        HEADER_TYPES.AUTH // Bearer token header
      );

      if (response.success && response.data) {
        return new ApiResponse("success", response.code, "Event details fetched successfully", response.data);
      } else {
        return new ApiResponse("error", response.code, response.message, response.data);
      }
    } catch (err) {
      return new ApiResponse("error", 500, err.message || "Fetching event details failed");
    }
  }

  // 🔹 Get event categories (requires auth token)
  async getEventCategories(eventId) {
    try {
      const response = await getRequest(
        `${ENDPOINTS.GET_EVENT_CATEGORIES}/${eventId}/categories`,
        HEADER_TYPES.AUTH // Bearer token header
      );

      // Handle the API response structure: {data: {status: "success", user_id: "25", categories: [...]}}
      if (response.status === "success" || response.code === 200) {
        // Extract categories from response.data.categories (nested structure)
        const categories = response.data?.categories || [];
        
        return new ApiResponse("success", response.code || 200, response.message || "Categories fetched successfully", categories);
      } else {
        return new ApiResponse("error", response.code || 500, response.message || "Failed to fetch categories", []);
      }
    } catch (err) {
      return new ApiResponse("error", 500, err.message || "Fetching categories failed", []);
    }
  }

  // 🔹 Get category classes (requires auth token)
  async getCategoryClasses(eventId, categoryId) {
    try {
      const response = await getRequest(
        `${ENDPOINTS.GET_CATEGORY_CLASSES}/${eventId}/categories/${categoryId}/classes`,
        HEADER_TYPES.AUTH // Bearer token header
      );

      // Handle the API response structure: {status: "success", classes: [...]}
      if (response.status === "success" || response.code === 200) {
        // Classes are directly in the response.classes array
        let classes = [];
        
        if (response.classes && Array.isArray(response.classes)) {
          // Structure: {status: "success", classes: [...]}
          classes = response.classes;
        } else if (response.data?.classes) {
          // Structure: {data: {classes: [...]}}
          classes = response.data.classes;
        } else if (Array.isArray(response.data)) {
          // Structure: {data: [...]} (direct array)
          classes = response.data;
        } else {
          // Fallback - try to find any array in the response
          classes = [];
        }
        
        return new ApiResponse("success", response.code || 200, response.message || "Classes fetched successfully", classes);
      } else {
        return new ApiResponse("error", response.code || 500, response.message || "Failed to fetch classes", []);
      }
    } catch (err) {
      return new ApiResponse("error", 500, err.message || "Fetching classes failed", []);
    }
  }

    // 🔹 Join event (requires auth token)
  async joinEvent(joinData) {
    try {
      // Validate join data before sending
      if (!joinData.event_id || !joinData.category_id || !joinData.class_id) {
        throw new Error("Missing required fields: event_id, category_id, or class_id");
      }
      
      if (!joinData.crew_members || joinData.crew_members.length === 0) {
        throw new Error("At least one crew member is required");
      }
      
      const response = await postRequest(
        ENDPOINTS.JOIN_EVENT,
        joinData,
        HEADER_TYPES.AUTH // Standard JSON with Bearer token header
      );

      // Handle different response structures
      if (response.status === "success" || response.code === 200) {
        return new ApiResponse("success", response.code || 200, response.message || "Event joined successfully", response.data);
      } else {
        // Return error with proper message
        const errorMessage = response.message || response.error || "Failed to join event";
        return new ApiResponse("error", response.code || 500, errorMessage, response);
      }
    } catch (err) {
      // Handle different types of errors
      if (err.message.includes("Missing required fields")) {
        return new ApiResponse("error", 400, err.message, null);
      } else if (err.message.includes("crew member")) {
        return new ApiResponse("error", 400, err.message, null);
      } else {
        return new ApiResponse("error", 500, err.message || "Network error while joining event", null);
      }
    }
  }

  // 🔹 Get my events (requires auth token)
  async getMyEvents() {
    try {
      const response = await getRequest(
        ENDPOINTS.GET_MY_EVENTS,
        HEADER_TYPES.AUTH // Bearer token header
      );

      // Handle the API response structure
      if (response.status === "success" || response.code === 200) {
        // Extract the events data from response.data - try different structures
        let myEvents = [];
        
        if (response.data?.events) {
          // Structure like getEvents: {data: {events: [...]}}
          myEvents = response.data.events;
        } else if (Array.isArray(response.data)) {
          // Direct array: {data: [...]}
          myEvents = response.data;
        } else if (response.data?.myEvents) {
          // Possible structure: {data: {myEvents: [...]}}
          myEvents = response.data.myEvents;
        } else {
          // Fallback - try to find any array in data
          myEvents = [];
        }
        
        return new ApiResponse("success", response.code || 200, response.message || "My events fetched successfully", myEvents);
      } else {
        return new ApiResponse("error", response.code || 500, response.message || "Failed to fetch my events", []);
      }
    } catch (err) {
      return new ApiResponse("error", 500, err.message || "Fetching my events failed", []);
    }
  }

   // 🔹 Get checkpoints for a specific event (requires auth token)
  async getCheckpointsPerEvent(eventId) {
    try {
      const response = await getRequest(
        `${ENDPOINTS.GET_CHECKPOINTS_PER_EVENT}/${eventId}`,
        HEADER_TYPES.AUTH // Bearer token header
      );

      if ((response.status === "success" || response.code === 200) && response.data) {
        const kmlPath = response.data.kml_path || null;
        const organizerNo = response.data.event_organizer_no || null;
        const checkpoints = Array.isArray(response.data.checkpoints) ? response.data.checkpoints : [];
        return new ApiResponse("success", response.code || 200, response.message || "Checkpoints fetched successfully", { kml_path: kmlPath, checkpoints, event_organizer_no: organizerNo });
      } else {
        return new ApiResponse("error", response.code || 500, response.message || "Failed to fetch checkpoints", { kml_path: null, checkpoints: [], event_organizer_no: null });
      }
    } catch (err) {
      return new ApiResponse("error", 500, err.message || "Fetching checkpoints failed", { kml_path: null, checkpoints: [], event_organizer_no: null });
    }
  }

  // 🔹 Get config for a specific event (requires auth token)
  async getConfigPerEvent(eventId) {
    
    try {
      const response = await getRequest(
        `${ENDPOINTS.GET_CONFIG_PER_EVENT}${eventId}`,
        HEADER_TYPES.AUTH // Bearer token header
      );
      if ((response.status === "success" || response.code === 200) && response.data.config) {
        const config = response.data.config || null;
        return new ApiResponse("success", response.code || 200, response.message || "Config fetched successfully", config);
      } else {
        return new ApiResponse("error", response.code || 500, response.message || "Failed to fetch config", null);
      }
    } catch (err) {
      return new ApiResponse("error", 500, err.message || "Fetching config failed", null);
    }
  }
}

export default new EventService();
