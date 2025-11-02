# Integrations Server

The "integrations" server runs multiple Spaceport integrations and scripts:

- [LDAP Integration](integration_ldap.md)
	- `ldapserver`
- [Bambu 3D Printer Integration](Bambu%203D%20Printer%20Integration.md)
	- `p1s1`
	- `p1s2`
- [Prusa 3D Printer Integration](Prusa%203D%20Printer%20Integration.md)
	- `prusa`
- [Printer Billing Integration](Printer%20Billing%20Integration.md)
	- `printer`
- `garden` for capturing garden images using ffmpeg

The [Supervisor](Supervisor.md) service names are in the code blocks above. Configs are stored in `/etc/supervisor/conf.d/`. Reading these will tell you where all the code lives.

## Details

The server is a Debian VPS running on the local Proxmox server.

