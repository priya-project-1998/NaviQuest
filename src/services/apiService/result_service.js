import { getRequest, postRequest, HEADER_TYPES } from "../api";
import ENDPOINTS from "../endpoints";
import ApiResponse from "../ApiResponse";

class ResultService {
  // 🔹 Get user result for a specific event (requires auth token)
  async getUserResultPerEvent(eventId) {
    try {
      const response = await getRequest(
        `${ENDPOINTS.GET_PER_EVENT_RESULTS}${eventId}`,
        HEADER_TYPES.AUTH // Bearer token header
      );
      
      if (response.status === "success" || response.code === 200) {
        // Handle both nested and direct data structures
        let resultData = null;
        
        if (response.data?.data) {
          // Nested structure: response.data.data
          resultData = response.data.data;
        } else if (response.data) {
          // Direct structure: response.data
          resultData = response.data;
        } else {
          // Fallback
          resultData = {};
        }
        
        return new ApiResponse("success", response.code || 200, response.message || "Results fetched successfully", resultData);
      } else if (response.status === 404 || response.error === 404) {
        // Handle 404 - No results found for this user and event
        return new ApiResponse("no_results", 404, "You haven't participated in this event yet or results are not available.", null);
      } else {
        return new ApiResponse("error", response.code || 500, response.message || "Failed to fetch results", null);
      }
    } catch (err) {
      return new ApiResponse("error", 500, err.message || "Fetching results failed", null);
    }
  }
}

export default new ResultService();
