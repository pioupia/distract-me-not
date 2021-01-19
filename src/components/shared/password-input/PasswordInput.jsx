import { Component } from 'react';
import { Pane, TextInput, IconButton, Paragraph, EyeOpenIcon, EyeOffIcon } from 'evergreen-ui';
import { RawHTML, OuterPane } from '..';
import './PasswordInput.scss';

export class PasswordInput extends Component {

  constructor(props) {
    super(props);
    this.state = {
      value: props.value || '',
      isShown: false
    };
  }

  handleChange = (event) => {
    this.setState({ value: event.target.value });
    if (this.props.onChange) {
      this.props.onChange(event);
    }
  }

  toggle = (event) => {
    this.setState({ isShown: !this.state.isShown });
  }

  render() {
    return (
      <OuterPane {...this.props}>
        <Pane display="flex">
          <Pane display="flex" alignItems="center" flex={1} position="relative">
            <TextInput
              width="100%"
              type={this.state.isShown ? 'text' : 'password'}
              value={this.state.value}
              onChange={this.handleChange}
              placeholder={this.props.placeholder}
              disabled={this.props.disabled}
              required={this.props.required}
              //data-testid={this.props['data-testid']}
              paddingRight={40}
            />
            <IconButton
              appearance="minimal"
              className="password-toggle"
              icon={this.state.isShown ? EyeOffIcon : EyeOpenIcon}
              iconSize={18}
              paddingX={20}
              onClick={this.toggle}
              disabled={this.props.disabled}
            />
          </Pane>
        </Pane>
        {this.props.hint &&
          <Paragraph size={300} color="muted" marginTop={6}>
            <RawHTML>{this.props.hint}</RawHTML>
          </Paragraph>
        }
      </OuterPane>
    );
  }

}
