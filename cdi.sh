
# EXPERIMENTAL: change directory interactive
# Add this to ~/.bash_profile or .bashrc

function cd:interactive {
  mvi -cd 
    && export MVI_FROM_PATH=$(cat ./mvi_move_from.txt) 
    && export MVI_MOVE_PATH=$(cat ./mvi_move_to.txt) 
    && cd "$MVI_MOVE_PATH" 
    && rm -rf "$MVI_FROM_PATH/mvi_move_to.txt" 
    && rm -rf "$MVI_FROM_PATH/mvi_move_from.txt"
}

alias cdi=cd:interactive