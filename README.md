# Overlap
 
You talk to someone for two hours and leave without getting their number. You lose your keys somewhere and whoever finds them has no way to reach you. Overlap is for those moments.
 
You drop a pin at the exact spot where something happened and leave a short note. If someone else pins the same place, you can see each other's pins and send a request to connect. Contact details are only shared if both people agree.
 
Still a work in progress. The core flow works end to end.
 
## How it works
 
1. Sign up with email and password, or with Google.
2. Drop a pin on the map by clicking it or searching for an address. Pick a category: missed connection, lost item, or photo moment. Pins have a 200m radius and expire after 14 days by default.
3. Check a pin for overlaps. The backend finds other users' active pins whose radius overlaps yours, using PostGIS `ST_DWithin`.
4. Send a connection request from your pin to theirs.
5. They accept or decline. Only after an accept do both people see each other's contact email.
The dashboard has four tabs: Active Pins, Received, Sent, and Connections.