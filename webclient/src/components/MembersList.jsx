import React from 'react';
import { Link } from 'react-router-dom';
import { List, ListItem } from 'semantic-ui-react';

export function MembersList (p) {
  const list = p.list

  return (
    <List>
      { list.map(_member => (
        <ListItem key={'member' + _member.id}>
          <Link to={'/members/' + _member.id + '/'}>
            {_member.preferred_name} {_member.last_name}
          </Link>
        </ListItem>
      ))}
    </List>
  )
}