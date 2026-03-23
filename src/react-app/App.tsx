import { useState, useEffect } from "react";
import "./App.css";

interface RsvpResponse {
  guestName: string;
  attending: boolean;
  meal: string | null;
}

interface RsvpEntry {
  partyId: string;
  submittedAt: string;
  responses: RsvpResponse[];
  mailingAddress?: string;
}

interface ApiResponse {
  success: boolean;
  count?: number;
  rsvps?: RsvpEntry[];
  error?: string;
}

interface ApiError extends Error {
  authUrl?: string;
}

function App() {
  const [data, setData] = useState<RsvpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; authUrl?: string } | null>(null);

  useEffect(() => {
    fetch("/api/rsvps")
      .then(async (res) => {
        if (!res.ok) {
          let errJson: any = {};
          try {
            errJson = await res.json();
          } catch (e) {}
          const err = new Error(errJson.error || (res.status === 403 || res.status === 401 
            ? "Access denied. Please ensure you are authenticated via Cloudflare Access." 
            : `Failed to fetch: ${res.statusText}`)) as ApiError;
          err.authUrl = errJson.authUrl;
          throw err;
        }
        return res.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        if (json.success && json.rsvps) {
          setData(json.rsvps);
        } else {
          throw new Error(json.error || "Failed to load RSVP data.");
        }
      })
      .catch((err: any) => {
        setError({
          message: err.message || "An unknown error occurred",
          authUrl: err.authUrl
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="dashboard-container loading-state">
        <div className="spinner"></div>
        <p>Loading RSVPs securely...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-state">
          <h2>Authentication or Fetch Error</h2>
          <p>{error.message}</p>
          {error.authUrl && (
            <a href={error.authUrl} className="auth-button">
              Authenticate
            </a>
          )}
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalParties = data.length;
  let totalAttending = 0;
  let totalDeclined = 0;

  // Flatten responses
  const allGuests: { partyId: string; submittedAt: string; response: RsvpResponse, mailingAddress?: string }[] = [];

  data.forEach((party) => {
    party.responses.forEach((resp) => {
      if (resp.attending) totalAttending++;
      else totalDeclined++;

      allGuests.push({
        partyId: party.partyId,
        submittedAt: party.submittedAt,
        response: resp,
        mailingAddress: party.mailingAddress
      });
    });
  });

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>Wedding RSVP Admin</h1>
        <div className="header-status">
          <div className="status-dot"></div>
          Secured by Cloudflare Access
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-title">Parties Responded</span>
          <span className="stat-value">{totalParties}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Total Guests Attending</span>
          <span className="stat-value" style={{ color: "var(--success-color)" }}>{totalAttending}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Total Guests Declined</span>
          <span className="stat-value" style={{ color: "var(--danger-color)" }}>{totalDeclined}</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Total Responses</span>
          <span className="stat-value">{totalAttending + totalDeclined}</span>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header-content">
          <h2>Guest Details</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          {allGuests.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Status</th>
                  <th>Meal Choice</th>
                  <th>Party ID</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {allGuests.map((guest, idx) => (
                  <tr key={`${guest.partyId}-${idx}`}>
                    <td>
                      <div>{guest.response.guestName}</div>
                      {guest.mailingAddress && (
                        <div className="sub-text">Address: {guest.mailingAddress}</div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${guest.response.attending ? "badge-attending" : "badge-declined"}`}>
                        {guest.response.attending ? "Attending" : "Declined"}
                      </span>
                    </td>
                    <td>
                      {guest.response.attending && guest.response.meal ? guest.response.meal : "-"}
                    </td>
                    <td className="sub-text">{guest.partyId}</td>
                    <td className="sub-text">
                      {new Date(guest.submittedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No RSVPs have been submitted yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
